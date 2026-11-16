/**
 * Module: dataset.js
 * Sinh dữ liệu mẫu thực tế về sinh viên, thời khóa biểu và nhu cầu gửi xe máy
 * Phục vụ bài toán Khoa học dịch vụ (SSME) - PGS. TS. Hà Quang Thụy
 */

const MAJORS = [
  'Công nghệ Thông tin',
  'Hệ thống Thông tin',
  'Khoa học Máy tính',
  'Kỹ thuật Phần mềm',
  'Mạng máy tính & TTTT',
  'Trí tuệ Nhân tạo'
];

const DISTRICTS = [
  { name: 'Cầu Giấy (Gần trường)', distMin: 0.5, distMax: 2.5, lat: 21.037, lng: 105.783 },
  { name: 'Nam Từ Liêm', distMin: 3.0, distMax: 6.0, lat: 21.012, lng: 105.765 },
  { name: 'Bắc Từ Liêm', distMin: 3.5, distMax: 7.5, lat: 21.065, lng: 105.760 },
  { name: 'Thanh Xuân', distMin: 4.5, distMax: 8.0, lat: 20.998, lng: 105.805 },
  { name: 'Đống Đa', distMin: 4.0, distMax: 7.0, lat: 21.018, lng: 105.825 },
  { name: 'Hà Đông', distMin: 9.0, distMax: 15.0, lat: 20.972, lng: 105.776 },
  { name: 'Hoàng Mai', distMin: 10.0, distMax: 16.0, lat: 20.985, lng: 105.855 },
  { name: 'Long Biên / Gia Lâm', distMin: 14.0, distMax: 22.0, lat: 21.045, lng: 105.890 },
  { name: 'Đông Anh / Mê Linh', distMin: 16.0, distMax: 26.0, lat: 21.145, lng: 105.820 },
  { name: 'Hoài Đức / Đan Phượng', distMin: 12.0, distMax: 20.0, lat: 21.040, lng: 105.695 }
];

const LAST_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
const MIDDLE_NAMES = ['Văn', 'Thị', 'Đức', 'Hải', 'Quang', 'Minh', 'Thanh', 'Ngọc', 'Hữu', 'Anh', 'Tuấn', 'Phương'];
const FIRST_NAMES = ['An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Giang', 'Hà', 'Hải', 'Hiếu', 'Hoàng', 'Huy', 'Khoa', 'Linh', 'Long', 'Mai', 'Nam', 'Nghĩa', 'Phong', 'Quân', 'Sơn', 'Tâm', 'Thắng', 'Thịnh', 'Trang', 'Tùng', 'Việt', 'Vinh', 'Vy', 'Yên'];

// 24 ca học trong tuần: Thứ 2 đến Thứ 7, mỗi ngày 4 ca theo quy chuẩn đào tạo
const SESSIONS = [
  // Thứ 2
  { id: 'T2_C1', day: 'Thứ 2', shift: 'Ca 1', time: '07:00 - 09:35', name: 'T2 Ca 1' },
  { id: 'T2_C2', day: 'Thứ 2', shift: 'Ca 2', time: '10:00 - 12:35', name: 'T2 Ca 2' },
  { id: 'T2_C3', day: 'Thứ 2', shift: 'Ca 3', time: '13:20 - 15:55', name: 'T2 Ca 3' },
  { id: 'T2_C4', day: 'Thứ 2', shift: 'Ca 4', time: '16:20 - 18:55', name: 'T2 Ca 4' },

  // Thứ 3
  { id: 'T3_C1', day: 'Thứ 3', shift: 'Ca 1', time: '07:00 - 09:35', name: 'T3 Ca 1' },
  { id: 'T3_C2', day: 'Thứ 3', shift: 'Ca 2', time: '10:00 - 12:35', name: 'T3 Ca 2' },
  { id: 'T3_C3', day: 'Thứ 3', shift: 'Ca 3', time: '13:20 - 15:55', name: 'T3 Ca 3' },
  { id: 'T3_C4', day: 'Thứ 3', shift: 'Ca 4', time: '16:20 - 18:55', name: 'T3 Ca 4' },

  // Thứ 4
  { id: 'T4_C1', day: 'Thứ 4', shift: 'Ca 1', time: '07:00 - 09:35', name: 'T4 Ca 1' },
  { id: 'T4_C2', day: 'Thứ 4', shift: 'Ca 2', time: '10:00 - 12:35', name: 'T4 Ca 2' },
  { id: 'T4_C3', day: 'Thứ 4', shift: 'Ca 3', time: '13:20 - 15:55', name: 'T4 Ca 3' },
  { id: 'T4_C4', day: 'Thứ 4', shift: 'Ca 4', time: '16:20 - 18:55', name: 'T4 Ca 4' },

  // Thứ 5
  { id: 'T5_C1', day: 'Thứ 5', shift: 'Ca 1', time: '07:00 - 09:35', name: 'T5 Ca 1' },
  { id: 'T5_C2', day: 'Thứ 5', shift: 'Ca 2', time: '10:00 - 12:35', name: 'T5 Ca 2' },
  { id: 'T5_C3', day: 'Thứ 5', shift: 'Ca 3', time: '13:20 - 15:55', name: 'T5 Ca 3' },
  { id: 'T5_C4', day: 'Thứ 5', shift: 'Ca 4', time: '16:20 - 18:55', name: 'T5 Ca 4' },

  // Thứ 6
  { id: 'T6_C1', day: 'Thứ 6', shift: 'Ca 1', time: '07:00 - 09:35', name: 'T6 Ca 1' },
  { id: 'T6_C2', day: 'Thứ 6', shift: 'Ca 2', time: '10:00 - 12:35', name: 'T6 Ca 2' },
  { id: 'T6_C3', day: 'Thứ 6', shift: 'Ca 3', time: '13:20 - 15:55', name: 'T6 Ca 3' },
  { id: 'T6_C4', day: 'Thứ 6', shift: 'Ca 4', time: '16:20 - 18:55', name: 'T6 Ca 4' },

  // Thứ 7
  { id: 'T7_C1', day: 'Thứ 7', shift: 'Ca 1', time: '07:00 - 09:35', name: 'T7 Ca 1' },
  { id: 'T7_C2', day: 'Thứ 7', shift: 'Ca 2', time: '10:00 - 12:35', name: 'T7 Ca 2' },
  { id: 'T7_C3', day: 'Thứ 7', shift: 'Ca 3', time: '13:20 - 15:55', name: 'T7 Ca 3' },
  { id: 'T7_C4', day: 'Thứ 7', shift: 'Ca 4', time: '16:20 - 18:55', name: 'T7 Ca 4' }
];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min, max, decimals = 1) {
  const val = Math.random() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sinh thông tin chi tiết cho một sinh viên cụ thể theo mã
 * @param {string} studentId Mã sinh viên (ví dụ 24020000)
 */
function generateSingleStudent(studentId, defaultStatus = 'pending') {
  const fullName = `${randomChoice(LAST_NAMES)} ${randomChoice(MIDDLE_NAMES)} ${randomChoice(FIRST_NAMES)}`;
  const major = randomChoice(MAJORS);
  const districtObj = randomChoice(DISTRICTS);
  const distanceKm = randomFloat(districtObj.distMin, districtObj.distMax);
  const year = 1; // Khóa 2402 (K69 UET)

  // Chính sách ưu tiên (con thương binh, hoàn cảnh khó khăn, v.v.)
  const isPriorityPolicy = Math.random() < 0.15;

  // Thời khóa biểu thực tế: Học 4-8 ca/tuần trong 24 ca
  const classCount = randomInt(4, 8);
  const shuffledSessions = [...SESSIONS].sort(() => Math.random() - 0.5);
  const classSessions = shuffledSessions.slice(0, classCount).map(s => s.id);

  // Nguyện vọng số buổi/tuần muốn đi xe máy (1 - 2 buổi công bằng)
  const desiredDays = Math.min(2, classSessions.length);

  // Xếp hạng ưu tiên ca học (Priority Rank: 1 là muốn nhất, 2, 3...)
  const sessionPreferences = {};
  const prefShuffled = [...classSessions].sort(() => Math.random() - 0.5);
  prefShuffled.forEach((sId, idx) => {
    sessionPreferences[sId] = idx + 1;
  });

  return {
    id: studentId,
    name: fullName,
    major,
    year,
    district: districtObj.name,
    distanceKm,
    isPriorityPolicy,
    classSessions, // danh sách ca có lịch học
    desiredDays,   // số buổi muốn gửi xe
    sessionPreferences, // thứ tự ưu tiên các ca
    licensePlate: `29-${randomChoice(['A1', 'B1', 'C1', 'D1', 'E1'])}-${randomInt(10000, 99999)}`,
    status: defaultStatus
  };
}

/**
 * Sinh danh sách sinh viên với thời khóa biểu và các yếu tố dịch vụ
 * Chọn ngẫu nhiên (random sample) 'count' sinh viên trong dải mã 24020000 đến 24024000
 * @param {number} count Số lượng sinh viên có nhu cầu gửi xe (mặc định 350)
 */
function generateStudentDataset(count = 350) {
  const students = [];
  const minId = 24020000;
  const maxId = 24024000;
  const totalRange = maxId - minId + 1; // 4001 sinh viên tiềm năng

  // Tạo tập hợp các mã sinh viên ngẫu nhiên không trùng lặp trong khoảng [24020000, 24024000]
  const chosenIndices = new Set();
  const targetCount = Math.min(count, totalRange);

  while (chosenIndices.size < targetCount) {
    const randOffset = Math.floor(Math.random() * totalRange);
    chosenIndices.add(randOffset);
  }

  // Sắp xếp mã sinh viên tăng dần cho dễ theo dõi
  const sortedOffsets = Array.from(chosenIndices).sort((a, b) => a - b);
  const pendingCount = Math.min(30, Math.floor(targetCount * 0.1)); // ~30 sinh viên mẫu ở trạng thái chờ duyệt

  sortedOffsets.forEach((offset, idx) => {
    const studentId = String(minId + offset);
    // 30 sinh viên cuối (hoặc khi đăng ký mới) sẽ ở trạng thái chờ duyệt
    const status = (idx >= targetCount - pendingCount) ? 'pending' : 'approved';
    students.push(generateSingleStudent(studentId, status));
  });

  return students;
}

module.exports = {
  SESSIONS,
  DISTRICTS,
  generateSingleStudent,
  generateStudentDataset
};

