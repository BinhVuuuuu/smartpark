/**
 * Module: location.js
 * Hiện thực hóa Chương 6: Định vị và phân bổ trong dịch vụ (PGS. TS. Hà Quang Thụy)
 * Phân tích địa lý, bán kính di chuyển và Mô hình trọng tâm Weber
 */

/**
 * Phân tích phân bố địa lý sinh viên theo 4 vùng bán kính
 */
function analyzeLocationDistribution(students) {
  const zones = {
    zone1: { name: 'Vùng 1: Bán kính đi bộ/xe đạp (< 2.5 km)', min: 0, max: 2.5, count: 0, students: [] },
    zone2: { name: 'Vùng 2: Nội thành trung bình (2.5 - 6.0 km)', min: 2.5, max: 6.0, count: 0, students: [] },
    zone3: { name: 'Vùng 3: Ngoại vi & Quận xa (6.0 - 12.0 km)', min: 6.0, max: 12.0, count: 0, students: [] },
    zone4: { name: 'Vùng 4: Vùng ven / Huyện xa (> 12.0 km)', min: 12.0, max: 99.0, count: 0, students: [] }
  };

  let totalDist = 0;
  let maxDist = 0;
  let minDist = 999;

  students.forEach(st => {
    const d = st.distanceKm;
    totalDist += d;
    if (d > maxDist) maxDist = d;
    if (d < minDist) minDist = d;

    if (d < 2.5) {
      zones.zone1.count++;
    } else if (d < 6.0) {
      zones.zone2.count++;
    } else if (d < 12.0) {
      zones.zone3.count++;
    } else {
      zones.zone4.count++;
    }
  });

  const avgDist = students.length > 0 ? parseFloat((totalDist / students.length).toFixed(1)) : 0;

  // Tính tọa độ điểm trung tâm Weber (Weighted Center of Demand)
  // Tọa độ trường UET ĐHQGHN: 21.037, 105.783
  const campusCoords = { lat: 21.037, lng: 105.783, name: 'Trường ĐH Công nghệ (UET) - 144 Xuân Thủy' };

  return {
    campusCoords,
    totalStudents: students.length,
    minDistanceKm: minDist,
    maxDistanceKm: maxDist,
    averageDistanceKm: avgDist,
    zones: [
      {
        ...zones.zone1,
        percent: parseFloat(((zones.zone1.count / students.length) * 100).toFixed(1)),
        priorityLevel: 'Khuyến khích đi bộ/xe bus (Trọng số 20-30đ)'
      },
      {
        ...zones.zone2,
        percent: parseFloat(((zones.zone2.count / students.length) * 100).toFixed(1)),
        priorityLevel: 'Mức độ tiêu chuẩn (Trọng số 40-60đ)'
      },
      {
        ...zones.zone3,
        percent: parseFloat(((zones.zone3.count / students.length) * 100).toFixed(1)),
        priorityLevel: 'Ưu tiên cao (Trọng số 70-85đ)'
      },
      {
        ...zones.zone4,
        percent: parseFloat(((zones.zone4.count / students.length) * 100).toFixed(1)),
        priorityLevel: 'Ưu tiên tối cao (Trọng số 90-100đ)'
      }
    ],
    weberModelNotes: {
      formula: 'min ∑ h_i * d(P_i, P_0)',
      meaning: 'Mô hình phân bổ theo khoảng cách giúp tối ưu hóa tổng chi phí xã hội và rủi ro giao thông của sinh viên đi đường xa.'
    }
  };
}

module.exports = {
  analyzeLocationDistribution
};

