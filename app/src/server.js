/**
 * Server: server.js
 * Web Application: Hệ thống Xếp lịch Xe máy Dịch vụ Thông minh (SSME)
 * Chạy độc lập trên Node.js (Zero external dependency)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const db = require('./models/db');
const { SESSIONS, generateStudentDataset, generateSingleStudent } = require('./models/dataset');
const {
  ADMIN_USERNAME,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_STUDENT_PASSWORD,
  isValidStudentId,
  authenticate,
  changeStudentPassword
} = require('./models/auth');
const {
  FIVE_ELEMENTS_DEFINITION,
  calculatePriorityWeight,
  solveILP,
  solveGreedy,
  solveRandom,
  benchmarkAlgorithms,
  runSensitivityAnalysis
} = require('./models/optimizer');
const {
  calculateMMs,
  calculateErlangBLoss,
  compareQueueingScenarios
} = require('./models/queueing');
const {
  SD_LOGIC_PREMISES,
  SERVICE_BLUEPRINT,
  handleYieldSlot
} = require('./models/sdlogic');
const { analyzeLocationDistribution } = require('./models/location');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Cấu hình mặc định của hệ thống
const DEFAULT_CONFIG = {
  capacity: 50,  // C = 50 chỗ/buổi (tổng 600 slots/tuần cho 350 SV -> thể hiện rõ năng lực tối ưu hóa công bằng)
  maxDays: 2,    // K_max = 2 buổi/tuần
  minDays: 1,    // K_min = 1 buổi/tuần (mục tiêu công bằng)
  weights: {
    weightDistance: 0.50,
    weightPolicy: 0.25,
    weightPreference: 0.25
  },
  queueConfig: {
    lambda: 6.0, // 6 xe/phút
    mu: 8.0,     // 8 xe/phút/cửa (quét mã QR mất 7.5 giây)
    s: 2         // 2 làn kiểm soát
  }
};

// Nạp cấu hình từ SQLite Database (hoặc khởi tạo mặc định)
let currentConfig = db.getSystemConfig(DEFAULT_CONFIG);

// Khởi tạo hoặc nạp tập sinh viên từ Database SQLite (dải mã 24020000 - 24024000)
let students = db.getAllStudents();
if (students.length === 0) {
  console.log('[DB] Khởi tạo 350 sinh viên mẫu vào SQLite Database...');
  students = generateStudentDataset(350);
  db.saveAllStudents(students);
} else {
  console.log(`[DB] Đã nạp thành công ${students.length} sinh viên từ Database SQLite.`);
}

let currentAllocation = null;

function getApprovedStudents() {
  return students.filter(s => s.status === 'approved');
}

function recomputeAllocations(algorithm = 'ilp') {
  const approved = getApprovedStudents();
  let result = null;
  if (approved.length === 0) {
    result = {
      algorithm: 'ilp',
      algorithmType: 'Toàn cục tối ưu (ILP)',
      studentAllocations: {},
      sessionAllocations: {},
      sessionUsed: {},
      metrics: {
        totalAssignedSlots: 0,
        serviceRate: 0,
        totalStudentsServed: 0,
        jainFairness: 1.0,
        capacityViolations: 0
      }
    };
  } else if (algorithm === 'greedy') {
    result = solveGreedy(approved, currentConfig);
  } else if (algorithm === 'random') {
    result = solveRandom(approved, currentConfig);
  } else {
    result = solveILP(approved, currentConfig);
  }
  currentAllocation = result;
  db.saveAllocations(currentAllocation.studentAllocations);
  return currentAllocation;
}

// Chạy thuật toán tối ưu ban đầu cho các sinh viên đã được phê duyệt
recomputeAllocations();

/**
 * Tìm hoặc cấp phát hồ sơ cho sinh viên hợp lệ trong dải 24020000 - 24024000
 * Lưu trữ bền vững vào Database SQLite
 * Sinh viên mới tạo mặc định ở trạng thái 'pending' (chờ Admin duyệt vào lịch)
 */
function getOrCreateStudent(studentId) {
  let student = students.find(s => s.id === studentId);
  if (!student && isValidStudentId(studentId)) {
    student = db.getStudentById(studentId);
    if (!student) {
      student = generateSingleStudent(studentId, 'pending');
      db.saveStudent(student);
    }
    students.push(student);
  }
  return student;
}

/**
 * Helper: Đọc body JSON từ request
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Helper: Trả về JSON
 */
function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

/**
 * MIME types cho static files
 */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = reqUrl.pathname || '/';
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  // Xử lý CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // ==========================================
  // API ROUTES
  // ==========================================

  // 1. Trạng thái chung & config
  if (pathname === '/api/status' && req.method === 'GET') {
    const approvedCount = students.filter(s => s.status === 'approved').length;
    const pendingCount = students.filter(s => s.status === 'pending').length;
    const rejectedCount = students.filter(s => s.status === 'rejected').length;
    return sendJson(res, 200, {
      status: 'active',
      config: currentConfig,
      totalStudents: students.length,
      approvedStudents: approvedCount,
      pendingStudents: pendingCount,
      rejectedStudents: rejectedCount,
      currentAlgorithm: currentAllocation.algorithm,
      metrics: currentAllocation.metrics,
      sessions: SESSIONS
    });
  }

  // 1.1 Xử lý Đăng nhập (Auth)
  if (pathname === '/api/login' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const username = (body.username || '').trim();
      const password = (body.password || '').trim();

      const authResult = authenticate(username, password);
      if (!authResult.success) {
        return sendJson(res, 401, authResult);
      }

      if (authResult.role === 'admin') {
        return sendJson(res, 200, {
          success: true,
          role: 'admin',
          username: ADMIN_USERNAME,
          name: 'Ban Quản Trị Bãi Xe (Admin)',
          mustChangePassword: false,
          message: authResult.message
        });
      }

      // Tài khoản Sinh viên (24020000 - 24024000)
      const student = getOrCreateStudent(authResult.studentId);
      if (!student) {
        return sendJson(res, 404, { success: false, message: 'Không thể khởi tạo thông tin sinh viên!' });
      }

      return sendJson(res, 200, {
        success: true,
        role: 'student',
        studentId: student.id,
        name: student.name,
        student: student,
        mustChangePassword: authResult.mustChangePassword,
        isFirstLogin: authResult.isFirstLogin,
        message: authResult.message
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 1.1.1 Đổi mật khẩu tài khoản sinh viên (Chỉ áp dụng cho sinh viên)
  if (pathname === '/api/student/change-password' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const { studentId, currentPassword, newPassword } = body;
      const result = changeStudentPassword(studentId, currentPassword, newPassword);
      if (!result.success) {
        return sendJson(res, 400, result);
      }
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 1.2 Sinh viên Cập nhật & Đăng ký xếp xe
  if (pathname === '/api/student/register-preferences' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const { studentId, desiredDays, distanceKm, district, licensePlate, preferredSessions } = body;

      const student = getOrCreateStudent(studentId);
      if (!student) {
        return sendJson(res, 404, { success: false, message: 'Không tìm thấy sinh viên!' });
      }

      if (desiredDays) student.desiredDays = parseInt(desiredDays, 10);
      if (distanceKm) student.distanceKm = parseFloat(distanceKm);
      if (district) student.district = district;
      if (licensePlate) student.licensePlate = licensePlate;

      // Cập nhật ưu tiên ca học
      if (Array.isArray(preferredSessions) && preferredSessions.length > 0) {
        student.sessionPreferences = {};
        preferredSessions.forEach((sId, idx) => {
          student.sessionPreferences[sId] = idx + 1;
        });
      }

      // Khi sinh viên đăng ký hoặc cập nhật nguyện vọng: chuyển trạng thái thành 'pending' (chờ Admin duyệt)
      student.status = 'pending';
      student.updatedAt = new Date().toISOString();
      db.saveStudent(student);

      // Tái tính toán lại phân bổ cho các sinh viên đã được phê duyệt (sinh viên này chưa được xếp vào lịch)
      recomputeAllocations();

      return sendJson(res, 200, {
        success: true,
        status: 'pending',
        message: `Đăng ký của bạn đã được ghi nhận thành công và đang CHỜ BAN QUẢN TRỊ DUYỆT! Sau khi được Admin phê duyệt, lịch đi xe máy và thẻ số QR sẽ được tự động kích hoạt.`,
        student,
        allocatedSessions: [],
        assignedDays: 0,
        metrics: currentAllocation.metrics
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 1.3 Quản trị viên lấy danh sách sinh viên chờ duyệt
  if (pathname === '/api/admin/pending-students' && req.method === 'GET') {
    const pendingList = students.filter(st => st.status === 'pending');
    return sendJson(res, 200, {
      total: pendingList.length,
      students: pendingList
    });
  }

  // 1.4 Quản trị viên phê duyệt hoặc từ chối sinh viên
  if (pathname === '/api/admin/approve-student' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const { studentId, action } = body; // action: 'approve' | 'reject'
      const student = students.find(s => s.id === studentId);
      if (!student) {
        return sendJson(res, 404, { success: false, message: 'Không tìm thấy thông tin sinh viên!' });
      }

      if (action === 'approve') {
        student.status = 'approved';
        student.updatedAt = new Date().toISOString();
        db.saveStudent(student);
        recomputeAllocations();

        const allocated = currentAllocation.studentAllocations[studentId] || [];
        return sendJson(res, 200, {
          success: true,
          action: 'approve',
          student,
          allocatedSessions: allocated,
          assignedDays: allocated.length,
          message: `Đã phê duyệt thành công sinh viên ${student.name} (${student.id})! Sinh viên đã được thêm vào lịch (${allocated.length} buổi).`,
          metrics: currentAllocation.metrics
        });
      } else {
        student.status = 'rejected';
        student.updatedAt = new Date().toISOString();
        db.saveStudent(student);
        recomputeAllocations();

        return sendJson(res, 200, {
          success: true,
          action: 'reject',
          student,
          message: `Đã từ chối đơn đăng ký của sinh viên ${student.name} (${student.id}).`,
          metrics: currentAllocation.metrics
        });
      }
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 1.5 Quản trị viên duyệt tất cả sinh viên đang chờ duyệt
  if (pathname === '/api/admin/approve-all' && req.method === 'POST') {
    try {
      let count = 0;
      const now = new Date().toISOString();
      for (const st of students) {
        if (st.status === 'pending') {
          st.status = 'approved';
          st.updatedAt = now;
          db.saveStudent(st);
          count++;
        }
      }
      recomputeAllocations();
      return sendJson(res, 200, {
        success: true,
        approvedCount: count,
        message: `Đã phê duyệt thành công toàn bộ ${count} sinh viên đang chờ duyệt! Toàn bộ đã được xếp vào lịch học.`,
        metrics: currentAllocation.metrics
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 2. Cập nhật cấu hình
  if (pathname === '/api/config' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      if (body.capacity) currentConfig.capacity = parseInt(body.capacity, 10);
      if (body.maxDays) currentConfig.maxDays = parseInt(body.maxDays, 10);
      if (body.minDays) currentConfig.minDays = parseInt(body.minDays, 10);
      if (body.weights) currentConfig.weights = { ...currentConfig.weights, ...body.weights };
      if (body.queueConfig) currentConfig.queueConfig = { ...currentConfig.queueConfig, ...body.queueConfig };

      // Lưu cấu hình vào SQLite
      db.saveSystemConfig(currentConfig);

      // Tái tối ưu hóa với cấu hình mới
      recomputeAllocations();

      return sendJson(res, 200, { success: true, config: currentConfig, metrics: currentAllocation.metrics });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 3. Tái sinh dữ liệu sinh viên
  if (pathname === '/api/regenerate-data' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const count = body.count ? parseInt(body.count, 10) : 350;

      // Xóa và tái tạo lại trong SQLite Database
      db.clearAllStudents();
      students = generateStudentDataset(count);
      db.saveAllStudents(students);

      recomputeAllocations();

      return sendJson(res, 200, { success: true, count: students.length, metrics: currentAllocation.metrics });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 4. Lấy danh sách sinh viên
  if (pathname === '/api/students' && req.method === 'GET') {
    const query = Object.fromEntries(reqUrl.searchParams.entries());
    const page = parseInt(query.page || 1, 10);
    const limit = parseInt(query.limit || 50, 10);
    const filterDistrict = query.district || '';
    const filterServedOnly = query.served === 'true';
    const filterStatus = query.status || '';

    let filtered = students.map(st => {
      const isApproved = (st.status === 'approved');
      const allocated = isApproved ? (currentAllocation.studentAllocations[st.id] || []) : [];
      return {
        ...st,
        allocatedSessions: allocated,
        assignedDays: allocated.length
      };
    });

    if (filterStatus) {
      filtered = filtered.filter(st => st.status === filterStatus);
    }
    if (filterDistrict) {
      filtered = filtered.filter(st => st.district.includes(filterDistrict));
    }
    if (filterServedOnly) {
      filtered = filtered.filter(st => st.assignedDays > 0);
    }

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return sendJson(res, 200, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      students: paginated
    });
  }

  // 5. Chi tiết 1 sinh viên & Giải thích quyết định (Explainable AI - XAI)
  if (pathname.startsWith('/api/student/') && req.method === 'GET') {
    const studentId = pathname.split('/')[3];
    const student = getOrCreateStudent(studentId);
    if (!student) {
      return sendJson(res, 404, { success: false, message: 'Không tìm thấy sinh viên' });
    }

    const isApproved = (student.status === 'approved');
    const allocated = isApproved ? (currentAllocation.studentAllocations[studentId] || []) : [];

    // Chi tiết điểm ưu tiên cho từng ca
    const explanationPerSession = {};
    student.classSessions.forEach(sId => {
      const { totalWeight, breakdown } = calculatePriorityWeight(student, sId, currentConfig);
      const isSessionApproved = allocated.includes(sId);
      explanationPerSession[sId] = {
        totalScore: totalWeight,
        breakdown,
        isApproved: isSessionApproved,
        sessionName: SESSIONS.find(s => s.id === sId)?.name || sId
      };
    });

    return sendJson(res, 200, {
      student,
      status: student.status,
      isApproved,
      allocatedSessions: allocated,
      assignedDays: allocated.length,
      explanationPerSession,
      qrPayload: {
        id: student.id,
        name: student.name,
        plate: student.licensePlate,
        slots: allocated,
        status: student.status,
        hash: isApproved ? `VERIFIED-${student.id}-${allocated.join('-')}` : `PENDING-${student.id}`
      }
    });
  }

  // 6. Thực hiện tối ưu hóa (Chương 4)
  if (pathname === '/api/optimize' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const algorithm = body.algorithm || 'ilp'; // 'ilp', 'greedy', 'random', 'benchmark'
      const approvedList = getApprovedStudents();

      if (algorithm === 'benchmark') {
        const benchmarkRes = benchmarkAlgorithms(approvedList, currentConfig);
        return sendJson(res, 200, benchmarkRes);
      } else if (algorithm === 'greedy') {
        currentAllocation = solveGreedy(approvedList, currentConfig);
      } else if (algorithm === 'random') {
        currentAllocation = solveRandom(approvedList, currentConfig);
      } else {
        currentAllocation = solveILP(approvedList, currentConfig);
      }

      // Lưu phân bổ mới vào SQLite Database
      db.saveAllocations(currentAllocation.studentAllocations);

      return sendJson(res, 200, {
        success: true,
        algorithm: currentAllocation.algorithm,
        algorithmType: currentAllocation.algorithmType,
        metrics: currentAllocation.metrics,
        sessionUsed: currentAllocation.sessionUsed
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 7. Lấy chi tiết ma trận phân bổ các ca (Heatmap / Schedule matrix)
  if (pathname === '/api/schedule-matrix' && req.method === 'GET') {
    const sessionsWithStats = SESSIONS.map(s => {
      const used = currentAllocation.sessionUsed[s.id] || 0;
      const cap = currentConfig.capacity;
      const rate = parseFloat(((used / cap) * 100).toFixed(1));
      const list = currentAllocation.sessionAllocations[s.id] || []; // Hiển thị đầy đủ danh sách sinh viên được duyệt
      return {
        ...s,
        used,
        capacity: cap,
        occupancyRate: rate,
        isFull: used >= cap,
        studentsList: list,
        topStudentsPreview: list
      };
    });

    return sendJson(res, 200, {
      capacityPerSession: currentConfig.capacity,
      sessions: sessionsWithStats
    });
  }

  // 8. 5 Yếu tố cốt yếu trong tối ưu hóa (Chương 4)
  if (pathname === '/api/five-elements' && req.method === 'GET') {
    return sendJson(res, 200, FIVE_ELEMENTS_DEFINITION);
  }

  // 9. Phân tích độ nhạy (Sensitivity Analysis - Yếu tố 5)
  if (pathname === '/api/sensitivity' && req.method === 'GET') {
    const sensData = runSensitivityAnalysis(students, currentConfig);
    return sendJson(res, 200, sensData);
  }

  // 10. Phân tích hàng đợi Markov M/M/s & Erlang-B (Chương 5)
  if (pathname === '/api/queue-analysis' && req.method === 'GET') {
    const qCfg = currentConfig.queueConfig;
    const mmsResult = calculateMMs(qCfg.lambda, qCfg.mu, qCfg.s);
    const erlangLoss = calculateErlangBLoss(currentConfig.capacity, 40, 3.5);
    const scenarios = compareQueueingScenarios();

    return sendJson(res, 200, {
      config: qCfg,
      mms: mmsResult,
      erlangLoss,
      scenarios
    });
  }

  // 11. Tính toán hàng đợi tùy biến
  if (pathname === '/api/queue-custom' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const lambda = parseFloat(body.lambda || 6.0);
      const mu = parseFloat(body.mu || 8.0);
      const s = parseInt(body.s || 2, 10);
      const result = calculateMMs(lambda, mu, s);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 12. Logic hướng dịch vụ & Service Blueprint (Chương 3)
  if (pathname === '/api/sdlogic' && req.method === 'GET') {
    return sendJson(res, 200, {
      premises: SD_LOGIC_PREMISES,
      blueprint: SERVICE_BLUEPRINT
    });
  }

  // 13. Hành động Đồng sáng tạo giá trị: Nhượng slot / Báo vắng
  if (pathname === '/api/sdlogic/yield-slot' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const { studentId, sessionId } = body;
      const yieldResult = handleYieldSlot(studentId, sessionId, currentAllocation, students, currentConfig);

      if (yieldResult.success) {
        // Cập nhật bảng allocations trong SQLite (giải phóng slot)
        db.removeAllocation(studentId, sessionId);
        if (yieldResult.reallocatedTo) {
          db.addAllocation(yieldResult.reallocatedTo.id, sessionId, 1);
        }
        // Ghi nhật ký đồng sáng tạo
        db.logCoCreation(studentId, sessionId, 'yield_slot', 0, yieldResult.reallocatedTo ? yieldResult.reallocatedTo.id : null);
      }

      // Cập nhật lại metrics
      currentAllocation.metrics = benchmarkAlgorithms(students, currentConfig).ilp.metrics;

      return sendJson(res, 200, yieldResult);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 14. Phân tích địa lý & mô hình Weber (Chương 6)
  if (pathname === '/api/location' && req.method === 'GET') {
    const locAnalysis = analyzeLocationDistribution(students);
    return sendJson(res, 200, locAnalysis);
  }

  // 15. Kiểm tra thông tin & trạng thái Cơ sở dữ liệu SQLite
  if (pathname === '/api/db/status' && req.method === 'GET') {
    const studentCount = db.getStudentCount();
    const accounts = db.getAllAccounts();
    const allocationsMap = db.getAllocationsMap();
    return sendJson(res, 200, {
      database: 'SQLite 3 (node:sqlite Native)',
      filePath: db.DB_FILE,
      tables: {
        students: studentCount,
        accounts: accounts.length,
        allocations: Object.values(allocationsMap.studentAllocations).reduce((acc, cur) => acc + cur.length, 0)
      },
      status: 'active & persistent'
    });
  }

  // ==========================================
  // STATIC FILES SERVING
  // ==========================================
  if (pathname.startsWith('/api/') || pathname === '/api') {
    return sendJson(res, 404, { success: false, message: `API endpoint '${pathname}' không tồn tại!` });
  }

  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Chống directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback về index.html cho SPA
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Internal Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` SMART PARKING SSME - KHOA HỌC DỊCH VỤ WEB APP`);
<<<<<<< HEAD
=======
  console.log(` Trường ĐH Công nghệ - ĐHQGHN (PGS. TS. Hà Quang Thụy)`);
>>>>>>> 045d18bc6ec7043410636de6317e553f086a972b
  console.log(` Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
