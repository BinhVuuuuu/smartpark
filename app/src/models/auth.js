/**
 * Module: auth.js
 * Quản lý xác thực & phân quyền hệ thống SmartPark UET
 * Lưu trữ và đối soát trực tiếp với bảng accounts trong cơ sở dữ liệu SQLite (smartpark.db)
 * - Tài khoản Quản trị viên (Admin): Mật khẩu bảo mật cao (Admin@SmartPark2026!)
 * - Tài khoản Sinh viên: Mã sinh viên từ 24020000 đến 24024000
 * - Mật khẩu mặc định sinh viên: 12345678
 * - Cơ chế đổi mật khẩu lần đầu (First-time password change) & mã hóa PBKDF2
 */

const crypto = require('crypto');
const { getAccount, saveAccount } = require('./db');

// Cấu hình tài khoản mặc định
const ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@SmartPark2026!';
const DEFAULT_STUDENT_PASSWORD = '12345678';

/**
 * Mã hóa mật khẩu an toàn với PBKDF2 và Salt ngẫu nhiên
 */
function hashPassword(password, existingSalt = null) {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

/**
 * So khớp mật khẩu
 */
function verifyPassword(password, salt, hash) {
  const computed = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return computed === hash;
}

/**
 * Kiểm tra mã sinh viên có thuộc dải hợp lệ 24020000 - 24024000 hay không
 */
function isValidStudentId(id) {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (!/^\d{8}$/.test(trimmed)) return false;
  const num = parseInt(trimmed, 10);
  return num >= 24020000 && num <= 24024000;
}

/**
 * Xác thực đăng nhập
 * @param {string} username Tên đăng nhập (admin hoặc mã SV 24020000 - 24024000)
 * @param {string} password Mật khẩu
 */
function authenticate(username, password) {
  const user = (username || '').trim();
  const pwd = (password || '').trim();

  if (!user || !pwd) {
    return { success: false, message: 'Vui lòng nhập đầy đủ tài khoản và mật khẩu!' };
  }

  // 1. Kiểm tra tài khoản Quản trị viên (Admin)
  if (user.toLowerCase() === ADMIN_USERNAME) {
    const adminAcc = getAccount(ADMIN_USERNAME);
    let isCorrect = false;

    if (adminAcc && adminAcc.salt && adminAcc.hash) {
      isCorrect = verifyPassword(pwd, adminAcc.salt, adminAcc.hash);
    } else {
      isCorrect = (pwd === DEFAULT_ADMIN_PASSWORD);
    }

    if (isCorrect) {
      return {
        success: true,
        role: 'admin',
        username: ADMIN_USERNAME,
        name: 'Ban Quản Trị Bãi Xe (Admin)',
        mustChangePassword: false,
        message: 'Đăng nhập Quản trị viên thành công'
      };
    } else {
      return {
        success: false,
        message: 'Mật khẩu Quản trị viên không chính xác! Hãy kiểm tra lại mật khẩu bảo mật.'
      };
    }
  }

  // 2. Kiểm tra tài khoản Sinh viên (Dải 24020000 đến 24024000)
  if (!isValidStudentId(user)) {
    return {
      success: false,
      message: 'Mã sinh viên không hợp lệ! Hệ thống chỉ áp dụng cho sinh viên có mã từ 24020000 đến 24024000.'
    };
  }

  const studentAcc = getAccount(user);

  // TH 1: Sinh viên đã từng đổi mật khẩu và lưu trong Database
  if (studentAcc && studentAcc.salt && studentAcc.hash) {
    const matches = verifyPassword(pwd, studentAcc.salt, studentAcc.hash);
    if (matches) {
      return {
        success: true,
        role: 'student',
        studentId: user,
        mustChangePassword: false,
        isFirstLogin: false,
        message: 'Đăng nhập thành công'
      };
    } else {
      return {
        success: false,
        message: 'Mật khẩu không chính xác! Bạn đã đổi mật khẩu trước đó, vui lòng nhập mật khẩu mới của bạn.'
      };
    }
  }

  // TH 2: Sinh viên chưa đổi mật khẩu (đăng nhập lần đầu với mật khẩu mặc định 12345678)
  if (pwd === DEFAULT_STUDENT_PASSWORD) {
    return {
      success: true,
      role: 'student',
      studentId: user,
      mustChangePassword: true, // Cần đổi mật khẩu lần đầu
      isFirstLogin: true,
      message: 'Đăng nhập lần đầu thành công! Vui lòng đổi mật khẩu để kích hoạt và bảo vệ tài khoản.'
    };
  }

  return {
    success: false,
    message: 'Mật khẩu không chính xác! (Mật khẩu mặc định sinh viên là 12345678).'
  };
}

/**
 * Đổi mật khẩu cho sinh viên (Chỉ áp dụng cho tài khoản sinh viên)
 * Lưu trực tiếp vào Database SQLite
 * @param {string} studentId Mã sinh viên (24020000 - 24024000)
 * @param {string} currentPassword Mật khẩu hiện tại
 * @param {string} newPassword Mật khẩu mới
 */
function changeStudentPassword(studentId, currentPassword, newPassword) {
  const id = (studentId || '').trim();
  const oldPwd = (currentPassword || '').trim();
  const newPwd = (newPassword || '').trim();

  if (!isValidStudentId(id)) {
    return { success: false, message: 'Mã sinh viên không hợp lệ!' };
  }

  if (!newPwd || newPwd.length < 6) {
    return { success: false, message: 'Mật khẩu mới phải có tối thiểu 6 ký tự!' };
  }

  if (newPwd === oldPwd) {
    return { success: false, message: 'Mật khẩu mới không được trùng với mật khẩu cũ!' };
  }

  const existingAcc = getAccount(id);

  // Kiểm tra mật khẩu cũ
  let oldMatches = false;
  if (existingAcc && existingAcc.salt && existingAcc.hash) {
    oldMatches = verifyPassword(oldPwd, existingAcc.salt, existingAcc.hash);
  } else {
    oldMatches = (oldPwd === DEFAULT_STUDENT_PASSWORD);
  }

  if (!oldMatches) {
    return { success: false, message: 'Mật khẩu hiện tại không chính xác!' };
  }

  // Tạo hash mới cho mật khẩu mới
  const creds = hashPassword(newPwd);
  saveAccount({
    username: id,
    role: 'student',
    salt: creds.salt,
    hash: creds.hash,
    isFirstLogin: false,
    updatedAt: new Date().toISOString()
  });

  return {
    success: true,
    message: 'Đổi mật khẩu thành công! Mật khẩu mới đã được lưu an toàn vào cơ sở dữ liệu.',
    studentId: id
  };
}

module.exports = {
  ADMIN_USERNAME,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_STUDENT_PASSWORD,
  isValidStudentId,
  authenticate,
  changeStudentPassword
};
