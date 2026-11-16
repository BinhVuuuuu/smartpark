/**
 * Module: db.js
 * Quản lý cơ sở dữ liệu SQLite chuẩn hóa cho SmartPark UET
 * Sử dụng node:sqlite (DatabaseSync) tích hợp sẵn trong Node.js (Zero-dependency)
 * File CSDL lưu trữ tại: app/data/smartpark.db
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'smartpark.db');

// Khởi tạo thư mục data
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Khởi tạo kết nối SQLite
const db = new DatabaseSync(DB_FILE);

/**
 * Tạo cấu trúc bảng CSDL (Schema)
 */
function initSchema() {
  db.exec(`
    -- Bảng 1: Tài khoản đăng nhập (Admin & Sinh viên)
    CREATE TABLE IF NOT EXISTS accounts (
      username TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      salt TEXT NOT NULL,
      hash TEXT NOT NULL,
      is_first_login INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    -- Bảng 2: Hồ sơ sinh viên, thời khóa biểu và nguyện vọng gửi xe
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      major TEXT NOT NULL,
      year INTEGER NOT NULL DEFAULT 1,
      district TEXT NOT NULL,
      distance_km REAL NOT NULL,
      is_priority_policy INTEGER NOT NULL DEFAULT 0,
      co_creation_score INTEGER NOT NULL DEFAULT 0,
      class_sessions TEXT NOT NULL,          -- JSON string array e.g. ["T2_C1", "T4_C3"]
      desired_days INTEGER NOT NULL DEFAULT 2,
      session_preferences TEXT NOT NULL,     -- JSON string object e.g. {"T2_C1": 1}
      license_plate TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Bảng 3: Cấu hình hệ thống (Sức chứa C, K_max, Trọng số phân bổ, M/M/s)
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Bảng 4: Phân bổ chỗ gửi xe thực tế cho từng ca (Allocations)
    CREATE TABLE IF NOT EXISTS allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      is_reallocated INTEGER NOT NULL DEFAULT 0,
      allocated_at TEXT NOT NULL,
      UNIQUE(student_id, session_id),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    -- Bảng 5: Nhật ký hành động Đồng sáng tạo giá trị (S-D Logic Co-creation audit log)
    CREATE TABLE IF NOT EXISTS co_creation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      action TEXT NOT NULL,
      karma_awarded INTEGER NOT NULL DEFAULT 5,
      reallocated_to_student_id TEXT,
      created_at TEXT NOT NULL
    );

    -- Bảng 6: Thống kê hiệu năng (Metrics cache)
    CREATE TABLE IF NOT EXISTS optimization_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      algorithm TEXT NOT NULL,
      metrics_json TEXT NOT NULL,
      calculated_at TEXT NOT NULL
    );

    -- Chỉ mục tối ưu tốc độ truy vấn
    CREATE INDEX IF NOT EXISTS idx_students_district ON students(district);
    CREATE INDEX IF NOT EXISTS idx_allocations_student ON allocations(student_id);
    CREATE INDEX IF NOT EXISTS idx_allocations_session ON allocations(session_id);
  `);

  seedDefaultAdmin();
}

/**
 * Khởi tạo tài khoản Admin mặc định nếu chưa tồn tại
 */
function seedDefaultAdmin() {
  const existing = db.prepare('SELECT username FROM accounts WHERE username = ?').get('admin');
  if (!existing) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('Admin@SmartPark2026!', salt, 10000, 64, 'sha512').toString('hex');
    db.prepare(`
      INSERT INTO accounts (username, role, salt, hash, is_first_login, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('admin', 'admin', salt, hash, 0, new Date().toISOString());
  }
}

/**
 * Helper parse sinh viên từ hàng CSDL sang Object JS
 */
function mapStudentRow(row) {
  if (!row) return null;
  let classSessions = [];
  let sessionPreferences = {};
  try {
    classSessions = JSON.parse(row.class_sessions || '[]');
  } catch (_) { classSessions = []; }
  try {
    sessionPreferences = JSON.parse(row.session_preferences || '{}');
  } catch (_) { sessionPreferences = {}; }

  return {
    id: row.id,
    name: row.name,
    major: row.major,
    year: row.year,
    district: row.district,
    distanceKm: parseFloat(row.distance_km),
    isPriorityPolicy: row.is_priority_policy === 1,
    coCreationScore: parseInt(row.co_creation_score, 10) || 0,
    classSessions,
    desiredDays: parseInt(row.desired_days, 10) || 2,
    sessionPreferences,
    licensePlate: row.license_plate,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ==========================================
// CÁC HÀM THAO TÁC VỚI SINH VIÊN (STUDENTS)
// ==========================================

function getStudentCount() {
  const row = db.prepare('SELECT count(*) as count FROM students').get();
  return row ? row.count : 0;
}

function getAllStudents() {
  const rows = db.prepare('SELECT * FROM students ORDER BY id ASC').all();
  return rows.map(mapStudentRow);
}

function getStudentById(id) {
  const row = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  return mapStudentRow(row);
}

function saveStudent(st) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO students (
      id, name, major, year, district, distance_km,
      is_priority_policy, co_creation_score, class_sessions,
      desired_days, session_preferences, license_plate, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      major = excluded.major,
      year = excluded.year,
      district = excluded.district,
      distance_km = excluded.distance_km,
      is_priority_policy = excluded.is_priority_policy,
      co_creation_score = excluded.co_creation_score,
      class_sessions = excluded.class_sessions,
      desired_days = excluded.desired_days,
      session_preferences = excluded.session_preferences,
      license_plate = excluded.license_plate,
      status = excluded.status,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    st.id,
    st.name,
    st.major,
    st.year || 1,
    st.district,
    st.distanceKm,
    st.isPriorityPolicy ? 1 : 0,
    st.coCreationScore || 0,
    JSON.stringify(st.classSessions || []),
    st.desiredDays || 2,
    JSON.stringify(st.sessionPreferences || {}),
    st.licensePlate || '',
    st.status || 'pending',
    st.createdAt || now,
    now
  );
}

function saveAllStudents(studentsList) {
  db.exec('BEGIN TRANSACTION');
  try {
    for (const st of studentsList) {
      saveStudent(st);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function clearAllStudents() {
  db.exec('BEGIN TRANSACTION');
  try {
    db.exec('DELETE FROM allocations');
    db.exec('DELETE FROM students');
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function updateStudentPreferences(id, updates) {
  const student = getStudentById(id);
  if (!student) return null;

  if (updates.desiredDays !== undefined) student.desiredDays = parseInt(updates.desiredDays, 10);
  if (updates.distanceKm !== undefined) student.distanceKm = parseFloat(updates.distanceKm);
  if (updates.district !== undefined) student.district = updates.district;
  if (updates.licensePlate !== undefined) student.licensePlate = updates.licensePlate;
  if (updates.sessionPreferences !== undefined) student.sessionPreferences = updates.sessionPreferences;
  if (updates.status !== undefined) student.status = updates.status;

  saveStudent(student);
  return student;
}

function updateStudentKarma(id, deltaKarma) {
  const stmt = db.prepare(`
    UPDATE students
    SET co_creation_score = co_creation_score + ?,
        updated_at = ?
    WHERE id = ?
  `);
  stmt.run(deltaKarma, new Date().toISOString(), id);
}

function updateStudentStatus(id, status) {
  const stmt = db.prepare(`
    UPDATE students
    SET status = ?,
        updated_at = ?
    WHERE id = ?
  `);
  stmt.run(status, new Date().toISOString(), id);
}

function getStudentsByStatus(status) {
  const rows = db.prepare('SELECT * FROM students WHERE status = ? ORDER BY id ASC').all();
  return rows.map(mapStudentRow);
}

// ==========================================
// CÁC HÀM THAO TÁC VỚI PHÂN BỔ (ALLOCATIONS)
// ==========================================

function saveAllocations(studentAllocations) {
  const now = new Date().toISOString();
  db.exec('BEGIN TRANSACTION');
  try {
    db.exec('DELETE FROM allocations');
    const insert = db.prepare(`
      INSERT INTO allocations (student_id, session_id, is_reallocated, allocated_at)
      VALUES (?, ?, ?, ?)
    `);

    for (const [stId, sessions] of Object.entries(studentAllocations)) {
      for (const sId of sessions) {
        insert.run(stId, sId, 0, now);
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function getAllocationsMap() {
  const rows = db.prepare('SELECT student_id, session_id, is_reallocated FROM allocations').all();
  const studentAllocations = {};
  const sessionAllocations = {};
  const sessionUsed = {};
  const studentDays = {};

  for (const row of rows) {
    const sId = row.session_id;
    const stId = row.student_id;

    if (!studentAllocations[stId]) studentAllocations[stId] = [];
    studentAllocations[stId].push(sId);
    studentDays[stId] = (studentDays[stId] || 0) + 1;

    if (!sessionAllocations[sId]) sessionAllocations[sId] = [];
    sessionUsed[sId] = (sessionUsed[sId] || 0) + 1;
  }

  return { studentAllocations, studentDays, sessionUsed };
}

function removeAllocation(studentId, sessionId) {
  db.prepare('DELETE FROM allocations WHERE student_id = ? AND session_id = ?').run(studentId, sessionId);
}

function addAllocation(studentId, sessionId, isReallocated = 0) {
  db.prepare(`
    INSERT OR REPLACE INTO allocations (student_id, session_id, is_reallocated, allocated_at)
    VALUES (?, ?, ?, ?)
  `).run(studentId, sessionId, isReallocated ? 1 : 0, new Date().toISOString());
}

function logCoCreation(studentId, sessionId, action, karmaAwarded, reallocatedTo) {
  db.prepare(`
    INSERT INTO co_creation_logs (student_id, session_id, action, karma_awarded, reallocated_to_student_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(studentId, sessionId, action, karmaAwarded, reallocatedTo || null, new Date().toISOString());
}

// ==========================================
// CÁC HÀM THAO TÁC CẤU HÌNH (SYSTEM_CONFIG)
// ==========================================

function getSystemConfig(defaultConfig) {
  const rows = db.prepare('SELECT key, value FROM system_config').all();
  if (!rows || rows.length === 0) {
    saveSystemConfig(defaultConfig);
    return defaultConfig;
  }

  const cfg = { ...defaultConfig };
  for (const row of rows) {
    try {
      cfg[row.key] = JSON.parse(row.value);
    } catch (_) {
      cfg[row.key] = row.value;
    }
  }
  return cfg;
}

function saveSystemConfig(cfg) {
  const stmt = db.prepare('INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)');
  db.exec('BEGIN TRANSACTION');
  try {
    for (const [key, val] of Object.entries(cfg)) {
      stmt.run(key, JSON.stringify(val));
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ==========================================
// CÁC HÀM THAO TÁC TÀI KHOẢN (ACCOUNTS)
// ==========================================

function getAccount(username) {
  const row = db.prepare('SELECT * FROM accounts WHERE username = ?').get(username);
  if (!row) return null;
  return {
    username: row.username,
    role: row.role,
    salt: row.salt,
    hash: row.hash,
    isFirstLogin: row.is_first_login === 1,
    updatedAt: row.updated_at
  };
}

function saveAccount(acc) {
  db.prepare(`
    INSERT OR REPLACE INTO accounts (username, role, salt, hash, is_first_login, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    acc.username,
    acc.role,
    acc.salt,
    acc.hash,
    acc.isFirstLogin ? 1 : 0,
    acc.updatedAt || new Date().toISOString()
  );
}

function getAllAccounts() {
  const rows = db.prepare('SELECT username, role, is_first_login, updated_at FROM accounts').all();
  return rows.map(r => ({
    username: r.username,
    role: r.role,
    isFirstLogin: r.is_first_login === 1,
    updatedAt: r.updated_at
  }));
}

// Khởi tạo bảng khi nạp module
initSchema();

module.exports = {
  db,
  DB_FILE,
  initSchema,
  getStudentCount,
  getAllStudents,
  getStudentById,
  saveStudent,
  saveAllStudents,
  clearAllStudents,
  updateStudentPreferences,
  updateStudentKarma,
  updateStudentStatus,
  getStudentsByStatus,
  saveAllocations,
  getAllocationsMap,
  removeAllocation,
  addAllocation,
  logCoCreation,
  getSystemConfig,
  saveSystemConfig,
  getAccount,
  saveAccount,
  getAllAccounts
};

