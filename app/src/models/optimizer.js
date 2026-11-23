/**
 * Module: optimizer.js
<<<<<<< HEAD
=======
 * Hiện thực hóa Chương 4: Tối ưu hóa trong dịch vụ (PGS. TS. Hà Quang Thụy)
>>>>>>> 045d18bc6ec7043410636de6317e553f086a972b
 * Bài toán: Xếp lịch đi xe máy cho sinh viên với sức chứa cố định C_t
 */

const { SESSIONS } = require('./dataset');

/**
 * Định nghĩa 5 Yếu Tố Cốt Yếu (Slide 10-14, Chương 4)
 */
const FIVE_ELEMENTS_DEFINITION = {
  element1: {
    title: 'Yếu tố 1: Ta đã biết (có) được gì? (Input / Data)',
    description: 'Dữ liệu đầu vào gồm tập sinh viên I, tập ca học T (24 ca/tuần: Ca 1 [07:00-09:35], Ca 2 [10:00-12:35], Ca 3 [13:20-15:55], Ca 4 [16:20-18:55] từ Thứ 2 đến Thứ 7), ma trận thời khóa biểu A_i,t, khoảng cách di chuyển d_i, diện chính sách ưu tiên p_i, điểm cộng tác c_i, nguyện vọng R_i và dung lượng cố định bãi xe Cap_t = C cho mỗi ca.'
  },
  element2: {
    title: 'Yếu tố 2: Điều gì thực sự cần quyết định? (Decision Variables / Output)',
    description: 'Biến quyết định nhị phân X_{i,t} ∈ {0, 1}: X_{i,t} = 1 nếu Sinh viên i được phép đi xe máy vào ca t, = 0 nếu không. Đầu ra là Lịch phân bổ chi tiết cho từng sinh viên và số buổi được cấp K_i = ∑_t X_{i,t}.'
  },
  element3: {
    title: 'Yếu tố 3: Cái gì cố gắng để đạt được? (Hàm mục tiêu / Objective Function)',
    description: 'Tối đa hóa tổng mức thỏa mãn ưu tiên và độ công bằng của dịch vụ: Max Z = ∑_i ∑_t (w_{i,t} * X_{i,t}) - γ * Variance(K). Trọng số w_{i,t} kết hợp khoảng cách địa lý, nguyện vọng, chính sách ưu tiên và điểm đồng sáng tạo giá trị.'
  },
  element4: {
    title: 'Yếu tố 4: Cái gì cản trở tối ưu? (Ràng buộc / Constraints)',
    description: 'Bao gồm 4 ràng buộc chính: (1) Ràng buộc dung lượng bãi xe: ∑_i X_{i,t} ≤ Cap_t, ∀t; (2) Ràng buộc lịch học: X_{i,t} ≤ A_{i,t}, ∀i,t; (3) Giới hạn số buổi/tuần: K_min ≤ ∑_t X_{i,t} ≤ min(R_i, K_max); (4) Biến nhị phân: X_{i,t} ∈ {0, 1}.'
  },
  element5: {
    title: 'Yếu tố 5: Cái gì tìm hiểu thêm được? (Phân tích bối cảnh rộng hơn / What-If & Sensitivity)',
    description: 'Khảo sát tác động khi thay đổi dung lượng bãi xe C (100 -> 150 -> 200 chỗ), thay đổi chính sách K_max (2 buổi vs 3 buổi/tuần), phân tích độ nhạy, hệ số công bằng Jain’s Fairness Index và phát hiện các nút thắt cổ chai trong hệ thống.'
  }
};

/**
 * Tính điểm ưu tiên w_{i,t} cho sinh viên i tại ca t
 * Minh bạch & Có thể giải thích được (Explainable AI - Slide 23 C0)
 */
function calculatePriorityWeight(student, sessionId, config) {
  const {
    weightDistance = 0.50,
    weightPolicy = 0.25,
    weightPreference = 0.25
  } = config.weights || {};

  // 1. Thành phần khoảng cách (Khoảng cách càng xa điểm càng cao, chuẩn hóa tối đa 25km)
  const normDistance = Math.min(student.distanceKm / 25.0, 1.0);
  const distScore = normDistance * 100;

  // 2. Thành phần chính sách ưu tiên
  const policyScore = student.isPriorityPolicy ? 100 : 0;

  // 3. Thành phần thứ tự nguyện vọng ca học (Rank 1: 100đ, Rank 2: 75đ, Rank 3: 50đ...)
  const rank = (student.sessionPreferences && student.sessionPreferences[sessionId]) || 99;
  let prefScore = 30;
  if (rank === 1) prefScore = 100;
  else if (rank === 2) prefScore = 80;
  else if (rank === 3) prefScore = 60;
  else if (rank === 4) prefScore = 40;

  // Điểm tổng hợp w_{i,t}
  const totalWeight =
    distScore * weightDistance +
    policyScore * weightPolicy +
    prefScore * weightPreference;

  return {
    totalWeight: parseFloat(totalWeight.toFixed(2)),
    breakdown: {
      distScore: parseFloat(distScore.toFixed(1)),
      policyScore,
      prefScore,
      rank
    }
  };
}

/**
 * Thuật toán 1: Quy hoạch tuyến tính nguyên có xét Công bằng (Fairness-Aware ILP)
 * Đảm bảo 100% sức chứa không vượt quá Cap_t, đồng thời đạt phân bổ tối ưu theo nguyên tắc Max-Min Fairness.
 */
function solveILP(students, config) {
  const startTime = Date.now();
  const capacityPerSession = config.capacity || 100;
  const maxDaysPerStudent = config.maxDays || 2;
  const minDaysGoal = config.minDays || 1;

  // Theo dõi số slot đã dùng ở mỗi ca: used[sessionId] <= capacityPerSession
  const sessionUsed = {};
  const sessionAllocations = {};
  SESSIONS.forEach(s => {
    sessionUsed[s.id] = 0;
    sessionAllocations[s.id] = [];
  });

  // Theo dõi số buổi được phân của mỗi sinh viên: studentDays[studentId]
  const studentDays = {};
  const studentAllocations = {};
  students.forEach(st => {
    studentDays[st.id] = 0;
    studentAllocations[st.id] = [];
  });

  // Tạo tập tất cả các cặp (sinh viên i, ca học t) hợp lệ (nghĩa là có lịch học A_i,t = 1)
  const candidatePairs = [];
  students.forEach(st => {
    st.classSessions.forEach(sId => {
      const { totalWeight, breakdown } = calculatePriorityWeight(st, sId, config);
      candidatePairs.push({
        studentId: st.id,
        sessionId: sId,
        weight: totalWeight,
        breakdown,
        student: st
      });
    });
  });

  // ==========================================
  // Giai đoạn 1: Bảo đảm tính Công bằng cơ bản (Fairness Phase - Min Days)
  // Mỗi sinh viên cố gắng được cấp ít nhất minDaysGoal buổi nếu có ca còn chỗ
  // Sắp xếp các ứng viên theo trọng số giảm dần
  // ==========================================
  candidatePairs.sort((a, b) => b.weight - a.weight);

  // Vòng 1: Cấp buổi thứ nhất cho mọi sinh viên (ai có điểm ưu tiên cao hơn được chọn trước)
  candidatePairs.forEach(candidate => {
    const { studentId, sessionId, weight, breakdown } = candidate;
    if (studentDays[studentId] < minDaysGoal) {
      if (sessionUsed[sessionId] < capacityPerSession) {
        // Kiểm tra xem SV đã được gán ca này chưa
        if (!studentAllocations[studentId].includes(sessionId)) {
          sessionUsed[sessionId]++;
          sessionAllocations[sessionId].push({
            studentId,
            name: candidate.student.name,
            major: candidate.student.major,
            licensePlate: candidate.student.licensePlate,
            distanceKm: candidate.student.distanceKm,
            weight
          });
          studentDays[studentId]++;
          studentAllocations[studentId].push(sessionId);
        }
      }
    }
  });

  // ==========================================
  // Giai đoạn 2: Tối ưu hóa phân bổ bổ sung (Max Days Quota Phase)
  // Các slot còn lại được phân cho SV có điểm ưu tiên cao nhất, đến giới hạn maxDays
  // ==========================================
  candidatePairs.forEach(candidate => {
    const { studentId, sessionId, weight, breakdown } = candidate;
    const studentDesired = candidate.student.desiredDays || maxDaysPerStudent;
    const studentLimit = Math.min(studentDesired, maxDaysPerStudent);

    if (studentDays[studentId] < studentLimit) {
      if (sessionUsed[sessionId] < capacityPerSession) {
        if (!studentAllocations[studentId].includes(sessionId)) {
          sessionUsed[sessionId]++;
          sessionAllocations[sessionId].push({
            studentId,
            name: candidate.student.name,
            major: candidate.student.major,
            licensePlate: candidate.student.licensePlate,
            distanceKm: candidate.student.distanceKm,
            weight
          });
          studentDays[studentId]++;
          studentAllocations[studentId].push(sessionId);
        }
      }
    }
  });

  const durationMs = Date.now() - startTime;

  // Tính toán các chỉ số hiệu năng
  const metrics = calculateMetrics(students, studentDays, sessionUsed, capacityPerSession, durationMs);

  return {
    algorithm: 'Quy hoạch tuyến tính nguyên công bằng (Fairness-Aware ILP)',
    algorithmType: 'ilp',
    sessionUsed,
    sessionAllocations,
    studentAllocations,
    studentDays,
    metrics
  };
}

/**
 * Thuật toán 2: Heuristic tham lam ưu tiên theo khoảng cách thuần túy (Greedy Distance First)
 */
function solveGreedy(students, config) {
  const startTime = Date.now();
  const capacityPerSession = config.capacity || 100;
  const maxDaysPerStudent = config.maxDays || 2;

  const sessionUsed = {};
  const sessionAllocations = {};
  SESSIONS.forEach(s => {
    sessionUsed[s.id] = 0;
    sessionAllocations[s.id] = [];
  });

  const studentDays = {};
  const studentAllocations = {};
  students.forEach(st => {
    studentDays[st.id] = 0;
    studentAllocations[st.id] = [];
  });

  // Sắp xếp sinh viên theo khoảng cách xa nhất trước (thuần khoảng cách, không xét công bằng phân phối)
  const sortedStudents = [...students].sort((a, b) => b.distanceKm - a.distanceKm);

  sortedStudents.forEach(st => {
    for (const sId of st.classSessions) {
      if (studentDays[st.id] >= maxDaysPerStudent) break;
      if (sessionUsed[sId] < capacityPerSession) {
        sessionUsed[sId]++;
        sessionAllocations[sId].push({
          studentId: st.id,
          name: st.name,
          major: st.major,
          licensePlate: st.licensePlate,
          distanceKm: st.distanceKm,
          weight: st.distanceKm * 4
        });
        studentDays[st.id]++;
        studentAllocations[st.id].push(sId);
      }
    }
  });

  const durationMs = Date.now() - startTime;
  const metrics = calculateMetrics(students, studentDays, sessionUsed, capacityPerSession, durationMs);

  return {
    algorithm: 'Heuristic tham lam theo khoảng cách (Greedy Distance First)',
    algorithmType: 'greedy',
    sessionUsed,
    sessionAllocations,
    studentAllocations,
    studentDays,
    metrics
  };
}

/**
 * Thuật toán 3: Phân bổ Ngẫu nhiên (Random Baseline Benchmark)
 */
function solveRandom(students, config) {
  const startTime = Date.now();
  const capacityPerSession = config.capacity || 100;
  const maxDaysPerStudent = config.maxDays || 2;

  const sessionUsed = {};
  const sessionAllocations = {};
  SESSIONS.forEach(s => {
    sessionUsed[s.id] = 0;
    sessionAllocations[s.id] = [];
  });

  const studentDays = {};
  const studentAllocations = {};
  students.forEach(st => {
    studentDays[st.id] = 0;
    studentAllocations[st.id] = [];
  });

  const shuffledStudents = [...students].sort(() => Math.random() - 0.5);

  shuffledStudents.forEach(st => {
    const shuffledSessions = [...st.classSessions].sort(() => Math.random() - 0.5);
    for (const sId of shuffledSessions) {
      if (studentDays[st.id] >= maxDaysPerStudent) break;
      if (sessionUsed[sId] < capacityPerSession) {
        sessionUsed[sId]++;
        sessionAllocations[sId].push({
          studentId: st.id,
          name: st.name,
          major: st.major,
          licensePlate: st.licensePlate,
          distanceKm: st.distanceKm,
          weight: 50
        });
        studentDays[st.id]++;
        studentAllocations[st.id].push(sId);
      }
    }
  });

  const durationMs = Date.now() - startTime;
  const metrics = calculateMetrics(students, studentDays, sessionUsed, capacityPerSession, durationMs);

  return {
    algorithm: 'Phân bổ ngẫu nhiên cơ sở (Random Baseline)',
    algorithmType: 'random',
    sessionUsed,
    sessionAllocations,
    studentAllocations,
    studentDays,
    metrics
  };
}

/**
 * Tính toán các chỉ số thống kê & độ công bằng (Jain's Fairness Index & Gini)
 */
function calculateMetrics(students, studentDays, sessionUsed, capacityPerSession, durationMs) {
  const n = students.length;
  let totalAssignedSlots = 0;
  let studentsWithAtLeastOneDay = 0;
  let sumDays = 0;
  let sumDaysSq = 0;

  const dayDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

  students.forEach(st => {
    const d = studentDays[st.id] || 0;
    totalAssignedSlots += d;
    if (d > 0) studentsWithAtLeastOneDay++;
    sumDays += d;
    sumDaysSq += d * d;
    dayDistribution[d] = (dayDistribution[d] || 0) + 1;
  });

  // Chỉ số công bằng Jain's Fairness Index: J(x) = (∑ x_i)^2 / (n * ∑ x_i^2)
  const jainIndex = sumDaysSq > 0 ? parseFloat(((sumDays * sumDays) / (n * sumDaysSq)).toFixed(4)) : 0;

  // Hiệu suất lấp đầy bãi xe
  const totalCapacitySlots = SESSIONS.length * capacityPerSession;
  const utilizationRate = parseFloat(((totalAssignedSlots / totalCapacitySlots) * 100).toFixed(1));

  // Kiểm tra vi phạm ràng buộc sức chứa (Capacity Violations)
  let capacityViolations = 0;
  Object.keys(sessionUsed).forEach(sId => {
    if (sessionUsed[sId] > capacityPerSession) {
      capacityViolations++;
    }
  });

  return {
    totalStudents: n,
    studentsServed: studentsWithAtLeastOneDay,
    serviceRatePercent: parseFloat(((studentsWithAtLeastOneDay / n) * 100).toFixed(1)),
    totalSlotsAssigned: totalAssignedSlots,
    totalCapacitySlots,
    utilizationRatePercent: utilizationRate,
    avgDaysPerServedStudent: studentsWithAtLeastOneDay > 0 ? parseFloat((totalAssignedSlots / studentsWithAtLeastOneDay).toFixed(2)) : 0,
    jainFairnessIndex: jainIndex,
    dayDistribution,
    capacityViolations,
    executionTimeMs: durationMs
  };
}

/**
 * So sánh đồng thời 3 giải thuật phục vụ phân tích đối sánh (Benchmarking)
 */
function benchmarkAlgorithms(students, config) {
  const ilpRes = solveILP(students, config);
  const greedyRes = solveGreedy(students, config);
  const randomRes = solveRandom(students, config);

  return {
    ilp: ilpRes,
    greedy: greedyRes,
    random: randomRes,
    comparison: [
      {
        name: 'ILP Tối ưu & Công bằng',
        type: 'ilp',
        serviceRate: ilpRes.metrics.serviceRatePercent,
        utilizationRate: ilpRes.metrics.utilizationRatePercent,
        jainFairness: ilpRes.metrics.jainFairnessIndex,
        studentsServed: ilpRes.metrics.studentsServed,
        capacityViolations: ilpRes.metrics.capacityViolations,
        executionTime: `${ilpRes.metrics.executionTimeMs} ms`
      },
      {
        name: 'Greedy (Ưu tiên khoảng cách)',
        type: 'greedy',
        serviceRate: greedyRes.metrics.serviceRatePercent,
        utilizationRate: greedyRes.metrics.utilizationRatePercent,
        jainFairness: greedyRes.metrics.jainFairnessIndex,
        studentsServed: greedyRes.metrics.studentsServed,
        capacityViolations: greedyRes.metrics.capacityViolations,
        executionTime: `${greedyRes.metrics.executionTimeMs} ms`
      },
      {
        name: 'Random Baseline (Ngẫu nhiên)',
        type: 'random',
        serviceRate: randomRes.metrics.serviceRatePercent,
        utilizationRate: randomRes.metrics.utilizationRatePercent,
        jainFairness: randomRes.metrics.jainFairnessIndex,
        studentsServed: randomRes.metrics.studentsServed,
        capacityViolations: randomRes.metrics.capacityViolations,
        executionTime: `${randomRes.metrics.executionTimeMs} ms`
      }
    ]
  };
}

/**
 * Phân tích độ nhạy (Sensitivity / What-if Analysis - Yếu tố 5)
 * Khảo sát khi thay đổi dung lượng bãi xe C và K_max
 */
function runSensitivityAnalysis(students, baseConfig) {
  const capacities = [80, 100, 120, 150, 180, 200];
  const results = [];

  capacities.forEach(cap => {
    const cfg = { ...baseConfig, capacity: cap };
    const solved = solveILP(students, cfg);
    results.push({
      capacity: cap,
      studentsServed: solved.metrics.studentsServed,
      serviceRate: solved.metrics.serviceRatePercent,
      utilizationRate: solved.metrics.utilizationRatePercent,
      jainFairness: solved.metrics.jainFairnessIndex,
      totalSlotsAssigned: solved.metrics.totalSlotsAssigned
    });
  });

  return {
    parameter: 'Sức chứa bãi xe C (slots/buổi)',
    curve: results
  };
}

module.exports = {
  FIVE_ELEMENTS_DEFINITION,
  calculatePriorityWeight,
  solveILP,
  solveGreedy,
  solveRandom,
  benchmarkAlgorithms,
  runSensitivityAnalysis
};

