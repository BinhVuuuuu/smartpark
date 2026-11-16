/**
 * Module: sdlogic.js
 * Hiện thực hóa Chương 3: Logic hướng dịch vụ (S-D Logic) & Bản thiết kế dịch vụ (Service Blueprint)
 * (Stephen L. Vargo & Robert F. Lusch, Robert F. Lusch 2014, PGS. TS. Hà Quang Thụy)
 */

const SD_LOGIC_PREMISES = [
  {
    fp: 'FP1 / Tiên đề 1',
    concept: 'Dịch vụ là cơ sở nền tảng của mọi trao đổi',
    applicationInParking: 'Nhà trường và sinh viên không chỉ trao đổi "chỗ để xe vật lý" (tài nguyên toán hạng) mà trao đổi dịch vụ hỗ trợ di chuyển an toàn, đúng giờ phục vụ học tập nghiên cứu.'
  },
  {
    fp: 'FP2 / Tiên đề 2',
    concept: 'Trao đổi gián tiếp che khuất bản chất dịch vụ',
    applicationInParking: 'Vé xe giấy hoặc tiền gửi xe truyền thống dễ làm người ta ngộ nhận đây chỉ là giao dịch mua bán vé hàng hóa, thay vì dịch vụ bảo đảm an ninh và sắp xếp không gian cho sinh viên.'
  },
  {
    fp: 'FP3 / Tiên đề 3',
    concept: 'Hàng hóa là bộ truyền tải (phân phối) dịch vụ',
    applicationInParking: 'Thẻ gửi xe QR thông minh và rào chắn tự động không phải là sản phẩm cuối cùng mà là công cụ chuyển giao dịch vụ đỗ xe hiệu quả.'
  },
  {
    fp: 'FP4 / Tiên đề 4',
    concept: 'Tài nguyên toán tử là nguồn gốc cơ bản của lợi thế chiến lược',
    applicationInParking: 'Con người (sinh viên, ban quản lý, cán bộ an ninh) và tri thức (thuật toán tối ưu hóa, mô hình hàng đợi) là tài nguyên toán tử (operant resources) tạo nên sự vượt trội của hệ thống.'
  },
  {
    fp: 'FP5 / Tiên đề 5',
    concept: 'Mọi nền kinh tế đều là kinh tế dịch vụ',
    applicationInParking: 'Cơ sở hạ tầng của trường đại học đang dịch chuyển từ việc quản lý tài sản tĩnh sang cung cấp các gói dịch vụ sinh viên toàn diện.'
  },
  {
    fp: 'FP6 / Tiên đề 6',
    concept: 'Khách hàng luôn là người đồng sáng tạo giá trị (Value Co-creation)',
    applicationInParking: 'TRỌNG TÂM: Sinh viên không chỉ thụ động nhận slot. Họ chủ động cung cấp thời khóa biểu chính xác, check-in đúng giờ và BÁO VẮNG / NHƯỢNG SLOT khi không đi học để hệ thống cấp lại cho bạn khác!'
  },
  {
    fp: 'FP7 / Tiên đề 7',
    concept: 'Doanh nghiệp chỉ có thể đưa ra đề xuất giá trị (Value Proposition)',
    applicationInParking: 'Nhà trường cam kết đề xuất giá trị: "Bảo đảm luôn có chỗ đỗ an toàn, không lo hết chỗ vào giờ cao điểm" nếu sinh viên cùng tuân thủ lịch xếp.'
  },
  {
    fp: 'FP8 / Tiên đề 8',
    concept: 'Mọi chủ thể kinh tế là những người tích hợp tài nguyên (Resource Integrators)',
    applicationInParking: 'Sinh viên tích hợp lịch học, phương tiện cá nhân, ứng dụng web để sắp xếp hành trình di chuyển tối ưu nhất trong tuần.'
  },
  {
    fp: 'FP9 / Tiên đề 9',
    concept: 'Bản chất của dịch vụ mang tính quan hệ và mạng lưới',
    applicationInParking: 'Hệ sinh thái bãi xe kết nối Sinh viên - Phòng Quản lý Đào tạo - Ban An ninh bảo vệ - Đội tình nguyện viên.'
  },
  {
    fp: 'FP10 / Tiên đề 10',
    concept: 'Giá trị luôn được xác định độc nhất và theo ngữ cảnh bởi người hưởng lợi',
    applicationInParking: 'Một slot gửi xe vào ngày mưa bão đối với sinh viên nhà cách xa 15km có giá trị trải nghiệm lớn hơn rất nhiều so với sinh viên ở trọ ngay đối diện cổng trường.'
  }
];

const SERVICE_BLUEPRINT = {
  serviceName: 'Hệ thống Dịch vụ Xếp lịch Bãi xe Máy Thông minh (UET Smart Parking)',
  layers: [
    {
      layerId: 'customer_actions',
      title: '1. Hành động của Khách hàng (Sinh viên)',
      steps: [
        'Truy cập cổng portal sinh viên',
        'Đăng ký nguyện vọng & đồng bộ thời khóa biểu',
        'Nhận thông báo lịch được duyệt tuần mới',
        'Quét mã QR tại cổng gửi xe khi đến trường',
        'Thao tác "Nhượng slot / Báo vắng" khi bận'
      ]
    },
    {
      layerId: 'onstage_actions',
      title: '2. Tương tác Sân khấu Trực diện (Frontstage Contact)',
      steps: [
        'Giao diện Web/App thông báo lịch và vé QR code',
        'Màn hình LED hiển thị số chỗ trống theo thời gian thực',
        'Máy quét QR tại cổng kiểm soát bảo vệ',
        'Âm thanh báo "Hợp lệ / Mời vào" và mở barrier'
      ]
    },
    {
      layerId: 'backstage_actions',
      title: '3. Tác vụ Hậu trường Vô hình (Backstage Contact)',
      steps: [
        'Động cơ Tối ưu hóa ILP chạy xếp lịch định kỳ cuối tuần',
        'Bộ giám sát hàng đợi M/M/s theo dõi tải thời gian thực',
        'Hệ thống tự động tái khớp nối slot khi có sinh viên báo vắng',
        'Tự động giải phóng hoặc điều phối slot cho sinh viên trong danh sách chờ'
      ]
    },
    {
      layerId: 'support_processes',
      title: '4. Quy trình & Hạ tầng Hỗ trợ (Support Processes)',
      steps: [
        'Cơ sở dữ liệu sinh viên và lịch giảng dạy (TKB Đào tạo)',
        'Server tính toán tối ưu hóa quy hoạch tuyến tính',
        'Hệ thống quản lý dữ liệu an ninh & camera nhận diện biển số',
        'Báo cáo thống kê hiệu năng dịch vụ gửi Ban Giám hiệu'
      ]
    }
  ]
};

/**
 * Xử lý hành động Đồng sáng tạo giá trị: Sinh viên nhượng slot / Báo vắng
 */
function handleYieldSlot(studentId, sessionId, currentAllocations, students, config) {
  const student = students.find(s => s.id === studentId);
  if (!student) {
    return { success: false, message: 'Không tìm thấy sinh viên!' };
  }

  // Kiểm tra xem sinh viên có slot ở ca này không
  const allocatedSessions = currentAllocations.studentAllocations[studentId] || [];
  if (!allocatedSessions.includes(sessionId)) {
    return { success: false, message: `Sinh viên ${student.name} không có lịch được duyệt vào ca ${sessionId}!` };
  }

  // 1. Hủy slot của sinh viên hiện tại
  currentAllocations.studentAllocations[studentId] = allocatedSessions.filter(s => s !== sessionId);
  currentAllocations.studentDays[studentId] = Math.max(0, (currentAllocations.studentDays[studentId] || 1) - 1);

  // Xóa khỏi danh sách sessionAllocations
  currentAllocations.sessionAllocations[sessionId] = currentAllocations.sessionAllocations[sessionId].filter(
    item => item.studentId !== studentId
  );
  currentAllocations.sessionUsed[sessionId] = Math.max(0, currentAllocations.sessionUsed[sessionId] - 1);

  // 2. Tìm sinh viên trong danh sách chờ (Waitlist) có lịch học ca này và chưa có slot
  const waitlistedCandidates = students.filter(st => {
    const hasClass = st.classSessions.includes(sessionId);
    const notAssignedThisSession = !(currentAllocations.studentAllocations[st.id] || []).includes(sessionId);
    const belowLimit = (currentAllocations.studentDays[st.id] || 0) < (config.maxDays || 2);
    return hasClass && notAssignedThisSession && belowLimit && st.id !== studentId;
  });

  let matchedStudent = null;
  if (waitlistedCandidates.length > 0) {
    // Sắp xếp theo khoảng cách và độ ưu tiên để trao slot
    waitlistedCandidates.sort((a, b) => b.distanceKm - a.distanceKm);
    matchedStudent = waitlistedCandidates[0];

    // Cấp slot cho sinh viên mới
    currentAllocations.sessionUsed[sessionId]++;
    currentAllocations.sessionAllocations[sessionId].push({
      studentId: matchedStudent.id,
      name: matchedStudent.name,
      major: matchedStudent.major,
      licensePlate: matchedStudent.licensePlate,
      distanceKm: matchedStudent.distanceKm,
      weight: matchedStudent.distanceKm * 4,
      reallocated: true,
      fromStudent: student.name
    });

    if (!currentAllocations.studentAllocations[matchedStudent.id]) {
      currentAllocations.studentAllocations[matchedStudent.id] = [];
    }
    currentAllocations.studentAllocations[matchedStudent.id].push(sessionId);
    currentAllocations.studentDays[matchedStudent.id] = (currentAllocations.studentDays[matchedStudent.id] || 0) + 1;
  }

  return {
    success: true,
    yieldingStudent: {
      id: student.id,
      name: student.name
    },
    sessionId,
    reallocatedTo: matchedStudent ? {
      id: matchedStudent.id,
      name: matchedStudent.name,
      district: matchedStudent.district,
      distanceKm: matchedStudent.distanceKm
    } : null,
    message: matchedStudent
      ? `Đã nhượng thành công ca ${sessionId} cho sinh viên ${matchedStudent.name} (${matchedStudent.distanceKm} km)! Chỗ gửi xe đã được chuyển giao.`
      : `Đã giải phóng thành công chỗ gửi xe ca ${sessionId}.`
  };
}

module.exports = {
  SD_LOGIC_PREMISES,
  SERVICE_BLUEPRINT,
  handleYieldSlot
};

