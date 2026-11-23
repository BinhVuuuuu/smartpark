/**
 * Client Application: app.js
 * SmartPark UET - Hệ thống Xếp lịch Xe máy Sinh viên
 * Quản lý Đăng nhập (Admin / Sinh viên), Trang Quản trị & Trang Đăng ký Sinh viên
 */

// State toàn cục
let currentUser = null; // { role: 'admin' | 'student', studentId, name, ... }
let currentStudentData = null;
let currentConfig = null;
let queueAnimationStarted = false;

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});

/**
 * ==============================================================
 * 1. QUẢN LÝ ĐĂNG NHẬP & PHÂN QUYỀN
 * ==============================================================
 */

function initAuth() {
  const savedUser = sessionStorage.getItem('smartpark_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      renderViewForRole(currentUser.role);
      return;
    } catch (e) {
      sessionStorage.removeItem('smartpark_user');
    }
  }

  // Mặc định hiện màn hình Đăng nhập
  showView('view-login');
}

function showView(viewId) {
  document.getElementById('view-login').style.display = 'none';
  document.getElementById('view-admin').style.display = 'none';
  document.getElementById('view-student').style.display = 'none';

  const target = document.getElementById(viewId);
  if (target) {
    target.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function renderViewForRole(role) {
  if (role === 'admin') {
    showView('view-admin');
    initAdminDashboard();
  } else if (role === 'student') {
    showView('view-student');
    initStudentPortal(currentUser.studentId);
    if (currentUser && currentUser.mustChangePassword) {
      setTimeout(() => openChangePasswordModal(true), 350);
    }
  } else {
    showView('view-login');
  }
}

/**
 * Xử lý Submit Form Đăng nhập
 */
async function handleLoginSubmit(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const errorBox = document.getElementById('loginErrorMsg');

  errorBox.style.display = 'none';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      console.error('Không thể đọc JSON phản hồi:', parseErr);
      errorBox.textContent = `Lỗi phản hồi từ máy chủ (HTTP ${res.status}). Vui lòng thử lại.`;
      errorBox.style.display = 'block';
      return;
    }

    if (data.success) {
      currentUser = data;
      sessionStorage.setItem('smartpark_user', JSON.stringify(currentUser));
      renderViewForRole(data.role);
    } else {
      errorBox.textContent = data.message || 'Tài khoản hoặc mật khẩu không chính xác';
      errorBox.style.display = 'block';
    }
  } catch (err) {
    console.error('Lỗi khi đăng nhập:', err);
    errorBox.textContent = 'Lỗi kết nối máy chủ! Vui lòng thử lại (' + (err.message || 'NetworkError') + ').';
    errorBox.style.display = 'block';
  }
}

/**
 * Đăng xuất
 */
function handleLogout() {
  currentUser = null;
  currentStudentData = null;
  sessionStorage.removeItem('smartpark_user');
  showView('view-login');
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
}

/**
 * ==============================================================
 * 2. TRANG QUẢN TRỊ VIÊN (ADMIN DASHBOARD)
 * ==============================================================
 */

async function initAdminDashboard() {
  try {
    const statusRes = await fetch('/api/status');
    const statusData = await statusRes.json();
    currentConfig = statusData.config;

    updateAdminNavAndKpis(statusData);
    await loadScheduleMatrix();
    await loadPendingStudents();
    await loadAllApprovedStudents();
    syncAdminControlForm(currentConfig);

    if (!queueAnimationStarted) {
      startQueueCanvas();
      queueAnimationStarted = true;
    }
  } catch (err) {
    console.error('Lỗi khi tải trang Admin:', err);
  }
}

function updateAdminNavAndKpis(statusData) {
  const cfg = statusData.config;
  const m = statusData.metrics;

  document.getElementById('adminNavCapacity').textContent = `${cfg.capacity} xe / ca`;

  const totalEl = document.getElementById('kpiTotalStudents');
  if (totalEl) totalEl.textContent = statusData.totalStudents || m.totalStudents;

  const servedEl = document.getElementById('kpiServedStudents');
  if (servedEl) servedEl.textContent = statusData.approvedStudents !== undefined ? statusData.approvedStudents : m.studentsServed;

  const pendingEl = document.getElementById('kpiPendingStudents');
  if (pendingEl) pendingEl.textContent = statusData.pendingStudents || 0;

  const rateEl = document.getElementById('kpiServedRate');
  if (rateEl) rateEl.textContent = `Đạt ${m.serviceRatePercent}% sinh viên đã duyệt`;

  document.getElementById('kpiTotalSlots').textContent = m.totalCapacitySlots.toLocaleString();

  const fairnessPct = (m.jainFairnessIndex * 100).toFixed(1);
  document.getElementById('kpiFairnessIndex').textContent = `${fairnessPct}%`;

  document.getElementById('ctrlServicedRate').textContent = `${m.serviceRatePercent}%`;
  document.getElementById('ctrlUtilRate').textContent = `${m.utilizationRatePercent}%`;
  document.getElementById('ctrlViolations').textContent = `${m.capacityViolations} ca`;
  document.getElementById('ctrlExecTime').textContent = `${m.executionTimeMs} ms`;
}

/**
 * ==============================================================
 * PHÊ DUYỆT ĐƠN ĐĂNG KÝ SINH VIÊN (ADMIN APPROVALS)
 * ==============================================================
 */

let allPendingStudentsCache = [];

async function loadPendingStudents() {
  try {
    const res = await fetch('/api/admin/pending-students');
    const data = await res.json();
    allPendingStudentsCache = data.students || [];

    const badge = document.getElementById('pendingTotalBadge');
    if (badge) {
      badge.textContent = `Chờ duyệt: ${allPendingStudentsCache.length} sinh viên`;
    }

    renderPendingStudentsTable(allPendingStudentsCache);
  } catch (err) {
    console.error('Lỗi khi tải danh sách chờ duyệt:', err);
  }
}

function renderPendingStudentsTable(list) {
  const tbody = document.getElementById('pendingStudentsList');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" style="text-align: center; color: var(--text-muted); padding: 24px;">
          🎉 Hiện không có đơn đăng ký nào chờ duyệt. Tất cả sinh viên đã được xét duyệt vào lịch!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map((st, idx) => {
    const sessionsTags = (st.classSessions || []).map(sId => {
      const sObj = SESSION_MAP[sId] || { name: sId };
      const isPref = st.sessionPreferences && (st.sessionPreferences[sId] === 1 || st.sessionPreferences[sId] === 2);
      return `<span class="session-chip-tag ${isPref ? 'active' : ''}">${sObj.name || sId}</span>`;
    }).join(' ');

    return `
      <tr>
        <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
        <td><strong>${st.id}</strong></td>
        <td><strong>${st.name}</strong></td>
        <td><small>${st.major}</small></td>
        <td><code class="plate-text">${st.licensePlate || '--'}</code></td>
        <td>${st.district}</td>
        <td>${st.distanceKm} km</td>
        <td style="text-align: center;"><strong>${st.desiredDays || 2}</strong> buổi</td>
        <td>${sessionsTags || '<span class="text-muted">Chưa chọn</span>'}</td>
        <td><span class="badge yellow">Chờ duyệt</span></td>
        <td style="text-align: center; white-space: nowrap;">
          <button class="btn-approve" onclick="handleApproveStudent('${st.id}')">✓ Phê duyệt</button>
          <button class="btn-reject" onclick="handleRejectStudent('${st.id}')">✕ Từ chối</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleApproveStudent(studentId) {
  try {
    const res = await fetch('/api/admin/approve-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, action: 'approve' })
    });
    const result = await res.json();
    if (result.success) {
      alert(result.message);
      await initAdminDashboard();
    } else {
      alert('Lỗi phê duyệt: ' + result.message);
    }
  } catch (err) {
    console.error('Lỗi duyệt sinh viên:', err);
  }
}

async function handleRejectStudent(studentId) {
  if (!confirm(`Bạn có chắc muốn từ chối đơn đăng ký của sinh viên ${studentId}?`)) return;
  try {
    const res = await fetch('/api/admin/approve-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, action: 'reject' })
    });
    const result = await res.json();
    if (result.success) {
      alert(result.message);
      await initAdminDashboard();
    } else {
      alert('Lỗi: ' + result.message);
    }
  } catch (err) {
    console.error('Lỗi từ chối sinh viên:', err);
  }
}

async function handleApproveAllStudents() {
  if (!confirm('Bạn có chắc muốn phê duyệt toàn bộ sinh viên đang chờ duyệt vào lịch xếp xe không?')) return;
  try {
    const res = await fetch('/api/admin/approve-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await res.json();
    if (result.success) {
      alert(result.message);
      await initAdminDashboard();
    } else {
      alert('Lỗi: ' + result.message);
    }
  } catch (err) {
    console.error('Lỗi phê duyệt tất cả:', err);
  }
}

function syncAdminControlForm(cfg) {
  if (!cfg) return;
  document.getElementById('inputCapacity').value = cfg.capacity || 50;
  document.getElementById('selectMaxDays').value = cfg.maxDays || 2;
  if (cfg.weights) {
    document.getElementById('rangeWeightDist').value = Math.round((cfg.weights.weightDistance || 0.5) * 100);
    updateWeightLabels();
  }
}

function updateWeightLabels() {
  const wDist = document.getElementById('rangeWeightDist').value;
  document.getElementById('lblWeightDist').textContent = `${wDist}%`;
}

/**
 * Tải ma trận nhiệt 12 ca bãi xe
 */
async function loadScheduleMatrix() {
  try {
    const res = await fetch('/api/schedule-matrix');
    const data = await res.json();

    const container = document.getElementById('sessionsHeatmap');
    if (!container || !data.sessions) return;

    container.innerHTML = data.sessions.map(s => {
      let barColor = 'green';
      if (s.occupancyRate >= 90) barColor = 'amber';
      if (s.occupancyRate >= 100) barColor = 'red';

      return `
        <div class="heat-card" onclick="openSessionDetail('${s.id}', '${s.name}')">
          <div class="heat-top">
            <span class="heat-name">${s.name}</span>
            <span class="heat-time">${s.time}</span>
          </div>
          <div class="heat-count">
            <span>Đã cấp: <strong>${s.used}</strong> / ${s.capacity}</span>
            <span class="badge ${barColor}">${s.occupancyRate}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-bar ${barColor}" style="width: ${Math.min(s.occupancyRate, 100)}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Lỗi khi tải schedule matrix:', err);
  }
}

async function openSessionDetail(sessionId, sessionName) {
  try {
    const res = await fetch('/api/schedule-matrix');
    const data = await res.json();
    const session = data.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const list = session.studentsList || session.topStudentsPreview || [];

    document.getElementById('sessionDetailTitle').textContent = `Danh sách Sinh viên được duyệt: ${sessionName}`;
    document.getElementById('sessionDetailSubtitle').textContent = `Đã cấp: ${list.length} / ${session.capacity} chỗ (Hiển thị đầy đủ toàn bộ ${list.length} sinh viên được duyệt)`;

    const tbody = document.getElementById('sessionStudentsList');
    if (list && list.length > 0) {
      tbody.innerHTML = list.map((st, idx) => `
        <tr>
          <td><strong>${st.studentId}</strong></td>
          <td>${st.name} ${st.reallocated ? '<span class="badge green">Được nhượng</span>' : ''}</td>
          <td>${st.major}</td>
          <td><code class="plate-text">${st.licensePlate}</code></td>
          <td>${st.district || 'Hà Nội'}</td>
          <td><strong>${st.distanceKm} km</strong></td>
          <td><span class="badge green">✔ Đã duyệt (#${idx + 1})</span></td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 16px;">Chưa có xe nào trong ca này.</td></tr>`;
    }

    const modal = document.getElementById('sessionDetailModal');
    modal.style.display = 'block';
    modal.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error(err);
  }
}

let allApprovedStudentsCache = [];

/**
 * Tải toàn bộ danh sách 350 sinh viên được duyệt gửi xe toàn trường
 */
async function loadAllApprovedStudents() {
  try {
    const res = await fetch('/api/students?limit=500&status=approved');
    const data = await res.json();
    allApprovedStudentsCache = data.students || [];
    renderApprovedStudentsTable(allApprovedStudentsCache);
  } catch (err) {
    console.error('Lỗi khi tải danh sách sinh viên được duyệt:', err);
  }
}

function renderApprovedStudentsTable(list) {
  const tbody = document.getElementById('allApprovedStudentsList');
  const badge = document.getElementById('approvedTotalBadge');
  if (!tbody) return;

  if (badge) {
    badge.textContent = `Đã duyệt: ${list.length} sinh viên`;
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding: 24px;">Không tìm thấy sinh viên phù hợp.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((st, idx) => {
    const sessionTags = (st.allocatedSessions || []).map(sId => {
      const sObj = SESSION_MAP[sId] || { day: sId, shift: '' };
      return `<span class="session-chip-tag">${sObj.day || sId} ${sObj.shift || ''}</span>`;
    }).join(' ');

    return `
      <tr>
        <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
        <td><strong>${st.id}</strong></td>
        <td><strong>${st.name}</strong></td>
        <td>${st.major}</td>
        <td><code class="plate-text">${st.licensePlate}</code></td>
        <td>${st.district}</td>
        <td>${st.distanceKm} km</td>
        <td style="text-align: center;"><strong>${st.assignedDays} buổi</strong></td>
        <td>${sessionTags || '<span class="text-muted">--</span>'}</td>
        <td><span class="badge green">✔ Đã duyệt</span></td>
      </tr>
    `;
  }).join('');
}

function filterApprovedStudents() {
  const query = (document.getElementById('adminStudentSearch').value || '').trim().toLowerCase();
  if (!query) {
    renderApprovedStudentsTable(allApprovedStudentsCache);
    return;
  }
  const filtered = allApprovedStudentsCache.filter(st =>
    st.id.toLowerCase().includes(query) ||
    st.name.toLowerCase().includes(query) ||
    (st.licensePlate && st.licensePlate.toLowerCase().includes(query)) ||
    (st.district && st.district.toLowerCase().includes(query))
  );
  renderApprovedStudentsTable(filtered);
}

function closeSessionDetail() {
  document.getElementById('sessionDetailModal').style.display = 'none';
}

/**
 * Chạy tối ưu hóa hoặc benchmark từ Admin
 */
async function triggerOptimization(algoType) {
  const cap = parseInt(document.getElementById('inputCapacity').value, 10);
  const maxD = parseInt(document.getElementById('selectMaxDays').value, 10);
  const wDist = parseInt(document.getElementById('rangeWeightDist').value, 10) / 100.0;

  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        capacity: cap,
        maxDays: maxD,
        weights: { weightDistance: wDist }
      })
    });

    const optRes = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ algorithm: algoType })
    });
    const optData = await optRes.json();

    if (algoType === 'benchmark' && optData.comparison) {
      const box = document.getElementById('benchmarkBox');
      const tbody = document.getElementById('benchmarkTableBody');
      tbody.innerHTML = optData.comparison.map(item => `
        <tr>
          <td><strong>${item.name}</strong></td>
          <td>${item.serviceRate}%</td>
          <td>${item.jainFairness}</td>
          <td>${item.capacityViolations === 0 ? '<span class="badge green">0 vi phạm</span>' : '<span class="badge red">' + item.capacityViolations + ' ca</span>'}</td>
        </tr>
      `).join('');
      box.style.display = 'block';
    } else {
      document.getElementById('benchmarkBox').style.display = 'none';
    }

    await initAdminDashboard();

    if (algoType === 'ilp') {
      alert(`Đã hoàn tất xếp lịch tự động! 100% ca học bảo đảm đủ chỗ (Sức chứa: ${cap} xe/ca).`);
    }
  } catch (err) {
    console.error('Lỗi khi xếp lịch:', err);
  }
}

async function regenerateData() {
  if (!confirm('Bạn có muốn tạo lại danh sách sinh viên và thời khóa biểu mới không?')) return;
  try {
    await fetch('/api/regenerate-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 350 })
    });
    await initAdminDashboard();
    alert('Đã cập nhật danh sách 350 sinh viên mới!');
  } catch (err) {
    console.error(err);
  }
}

/**
 * ==============================================================
 * 3. TRANG SINH VIÊN (STUDENT PORTAL & REGISTRATION)
 * ==============================================================
 */

async function initStudentPortal(studentId) {
  try {
    const res = await fetch(`/api/student/${studentId}`);
    const data = await res.json();
    currentStudentData = data;

    const st = data.student;
    const isApproved = (st.status === 'approved');
    const isPending = (st.status === 'pending');
    const isRejected = (st.status === 'rejected');

    // Header hiển thị tên SV
    document.getElementById('navStudentDisplay').textContent = `🎓 Sinh viên: ${st.name} (${st.id})`;

    // Banner trạng thái phê duyệt
    const banner = document.getElementById('studentStatusBanner');
    const bTitle = document.getElementById('studentBannerTitle');
    const bDesc = document.getElementById('studentBannerDesc');
    const bIcon = document.getElementById('studentBannerIcon');

    if (banner) {
      if (isPending) {
        banner.style.display = 'flex';
        banner.className = 'notice-banner banner-warning';
        if (bIcon) bIcon.textContent = '⏳';
        if (bTitle) bTitle.textContent = 'Hồ sơ đang chờ Ban Quản trị phê duyệt';
        if (bDesc) bDesc.textContent = 'Yêu cầu đăng ký xếp chỗ gửi xe của bạn đã được ghi nhận vào CSDL. Sau khi Admin phê duyệt, lịch gửi xe và thẻ QR chính thức sẽ được kích hoạt.';
      } else if (isRejected) {
        banner.style.display = 'flex';
        banner.className = 'notice-banner banner-danger';
        if (bIcon) bIcon.textContent = '❌';
        if (bTitle) bTitle.textContent = 'Yêu cầu đăng ký chưa được duyệt';
        if (bDesc) bDesc.textContent = 'Bãi xe đã vượt công suất tại các ca bạn đăng ký hoặc hồ sơ chưa đủ điều kiện. Bạn có thể thay đổi nguyện vọng ở form bên dưới để gửi lại.';
      } else {
        banner.style.display = 'none';
      }
    }

    // Digital Parking Pass
    document.getElementById('passName').textContent = st.name.toUpperCase();
    document.getElementById('passId').textContent = st.id;
    document.getElementById('passPlate').textContent = st.licensePlate;
    document.getElementById('passMajor').textContent = st.major;
    document.getElementById('passDistrict').textContent = `${st.district} (${st.distanceKm} km)`;

    const statusBadge = document.getElementById('passStatusBadge');
    if (statusBadge) {
      if (isApproved) {
        statusBadge.className = 'pass-status-badge approved';
        statusBadge.textContent = '✔ ĐÃ DUYỆT (HỢP LỆ)';
        document.getElementById('passQuotaText').textContent = `${data.assignedDays} buổi / tuần`;
        document.getElementById('studentSummaryTag').textContent = `Đã xếp ${data.assignedDays} buổi đi xe máy`;
      } else if (isPending) {
        statusBadge.className = 'pass-status-badge pending';
        statusBadge.textContent = '⏳ CHỜ DUYỆT';
        document.getElementById('passQuotaText').textContent = `⏳ Chờ Admin duyệt`;
        document.getElementById('studentSummaryTag').textContent = `⏳ Hồ sơ đang chờ phê duyệt`;
      } else {
        statusBadge.className = 'pass-status-badge rejected';
        statusBadge.textContent = '✕ TỪ CHỐI';
        document.getElementById('passQuotaText').textContent = `0 buổi / tuần`;
        document.getElementById('studentSummaryTag').textContent = `Chưa được cấp lịch`;
      }
    }

    // Render SVG QR Code (chỉ render hợp lệ khi đã duyệt)
    if (isApproved) {
      renderQrCodeSvg('qrContainer', data.qrPayload.hash);
    } else {
      document.getElementById('qrContainer').innerHTML = `
        <div style="font-size:0.68rem;text-align:center;color:#94a3b8;padding:8px 4px;line-height:1.2;">
          <div style="font-size:1.5rem;margin-bottom:2px;">🔒</div>
          Chờ duyệt<br>kích hoạt
        </div>
      `;
    }

    // Render Weekly Schedule
    renderStudentWeeklySchedule(data);

    // Pre-fill Registration Form
    prefillRegistrationForm(st);

    // Transparency text
    updateStudentTransparencyText(st, data.assignedDays);

  } catch (err) {
    console.error('Lỗi khi tải thông tin sinh viên:', err);
  }
}

// Định nghĩa chuẩn 24 ca học trong tuần: Ca 1 (07:00-09:35), Ca 2 (10:00-12:35), Ca 3 (13:20-15:55), Ca 4 (16:20-18:55)
const ALL_SESSIONS = [
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

const SESSION_MAP = {};
ALL_SESSIONS.forEach(s => {
  SESSION_MAP[s.id] = s;
});

function renderStudentWeeklySchedule(data) {
  const container = document.getElementById('studentScheduleGrid');
  if (!container) return;

  const st = data.student;
  const approvedList = data.allocatedSessions || [];
  const isPending = (st.status === 'pending');

  container.innerHTML = ALL_SESSIONS.map(s => {
    const hasClass = st.classSessions.includes(s.id);
    const isApproved = approvedList.includes(s.id);

    let cardClass = 'st-session-card';
    if (hasClass) cardClass += ' has-class';
    if (isApproved) cardClass += ' is-approved';

    let actionBtn = '';
    if (isApproved) {
      actionBtn = `<button class="btn-yield-slot" onclick="yieldSlot('${st.id}', '${s.id}')">🌟 Báo nghỉ / Nhượng chỗ</button>`;
    }

    let statusTag = '';
    if (isApproved) {
      statusTag = '<span class="badge green">✔ ĐƯỢC ĐI XE</span>';
    } else if (hasClass) {
      if (isPending) {
        statusTag = '<span class="badge yellow">⏳ Chờ duyệt</span>';
      } else {
        statusTag = '<span class="badge" style="background:#f1f5f9;color:#64748b;">Đi xe bus / Đi bộ</span>';
      }
    }

    return `
      <div class="${cardClass}">
        <div class="st-card-top">
          <span>${s.name}</span>
          <span style="font-size:0.72rem;color:#64748b;">${s.time}</span>
        </div>
        <div class="st-card-mid">
          ${hasClass ? '📚 Có lịch học tại trường' : '<span style="color:#94a3b8;">-- Nghỉ học --</span>'}
        </div>
        <div class="st-card-bot">
          ${statusTag}
        </div>
        ${actionBtn}
      </div>
    `;
  }).join('');
}

/**
 * Điền sẵn dữ liệu vào Form Đăng ký Xếp xe
 */
function prefillRegistrationForm(student) {
  document.getElementById('regDesiredDays').value = student.desiredDays || 2;
  document.getElementById('regLicensePlate').value = student.licensePlate || '';
  document.getElementById('regDistance').value = student.distanceKm || 12.0;

  // Chọn quận phù hợp
  const districtSelect = document.getElementById('regDistrict');
  for (let i = 0; i < districtSelect.options.length; i++) {
    if (districtSelect.options[i].value === student.district) {
      districtSelect.selectedIndex = i;
      break;
    }
  }

  // Render Checkbox các ca học có lịch
  const checkboxContainer = document.getElementById('regSessionCheckboxes');
  const prefMap = student.sessionPreferences || {};

  checkboxContainer.innerHTML = student.classSessions.map(sId => {
    const sInfo = SESSION_MAP[sId] || { name: sId, time: '' };
    const isPreferred = prefMap[sId] === 1 || prefMap[sId] === 2;
    return `
      <label class="checkbox-session-item">
        <input type="checkbox" name="preferredSession" value="${sId}" ${isPreferred ? 'checked' : ''}>
        <span><strong>${sInfo.day} - ${sInfo.shift}</strong> (${sInfo.time})</span>
      </label>
    `;
  }).join('');
}

function onDistrictChange() {
  const select = document.getElementById('regDistrict');
  const selectedOpt = select.options[select.selectedIndex];
  const dist = selectedOpt.getAttribute('data-dist');
  if (dist) {
    document.getElementById('regDistance').value = dist;
  }
}

/**
 * Sinh viên Gửi Form Đăng Ký Xếp Chỗ
 */
async function handleStudentRegisterSubmit(event) {
  event.preventDefault();
  if (!currentUser || !currentUser.studentId) return;

  const studentId = currentUser.studentId;
  const desiredDays = parseInt(document.getElementById('regDesiredDays').value, 10);
  const licensePlate = document.getElementById('regLicensePlate').value.trim();
  const district = document.getElementById('regDistrict').value;
  const distanceKm = parseFloat(document.getElementById('regDistance').value);

  // Thu thập các ca được tích chọn ưu tiên
  const checkboxes = document.querySelectorAll('input[name="preferredSession"]:checked');
  const preferredSessions = Array.from(checkboxes).map(cb => cb.value);

  const statusMsg = document.getElementById('regStatusMsg');

  try {
    const res = await fetch('/api/student/register-preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        desiredDays,
        licensePlate,
        district,
        distanceKm,
        preferredSessions
      })
    });
    const result = await res.json();

    if (result.success) {
      statusMsg.className = 'reg-status-msg success';
      statusMsg.textContent = `✔ ${result.message}`;
      statusMsg.style.display = 'inline';

      // Cập nhật lại giao diện sinh viên
      await initStudentPortal(studentId);
      alert('Đơn đăng ký của bạn đã được ghi nhận vào hệ thống!\nTrạng thái: CHỜ BAN QUẢN TRỊ DUYỆT ⏳\n\nSau khi Admin phê duyệt, lịch đi xe máy và thẻ số QR sẽ được tự động kích hoạt.');
    } else {
      statusMsg.className = 'reg-status-msg error';
      statusMsg.textContent = `❌ ${result.message}`;
      statusMsg.style.display = 'inline';
    }
  } catch (err) {
    statusMsg.className = 'reg-status-msg error';
    statusMsg.textContent = '❌ Lỗi kết nối khi gửi đăng ký!';
    statusMsg.style.display = 'inline';
  }
}

/**
 * Hành động: Sinh viên nhượng slot
 */
async function yieldSlot(studentId, sessionId) {
  if (!confirm(`Bạn có chắc muốn báo nghỉ và nhượng chỗ ca ${sessionId} cho bạn khác không?`)) {
    return;
  }

  try {
    const res = await fetch('/api/sdlogic/yield-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, sessionId })
    });
    const result = await res.json();

    if (result.success) {
      const alertBox = document.getElementById('coCreationAlert');
      const msgBox = document.getElementById('coCreationMessage');
      if (alertBox && msgBox) {
        msgBox.innerHTML = `<strong>Tuyệt vời!</strong> ${result.message}`;
        alertBox.style.display = 'flex';
      }

      await initStudentPortal(studentId);
    } else {
      alert(result.message || 'Không thể nhượng chỗ');
    }
  } catch (err) {
    console.error('Lỗi khi nhượng slot:', err);
  }
}

function updateStudentTransparencyText(student, assignedDays) {
  const el = document.getElementById('studentReasonText');
  if (!el) return;

  let reason = `Sinh viên <strong>${student.name}</strong> (${student.district}, cách trường ${student.distanceKm} km). `;
  if (student.distanceKm >= 8.0) {
    reason += `Nơi ở xa (> 8 km) nên được hệ thống ưu tiên xếp ${assignedDays} buổi vào các ca học chính. `;
  } else {
    reason += `Nơi ở gần trường (< 5 km), được sắp xếp ${assignedDays} buổi đi xe máy, các buổi còn lại được khuyến khích đi xe bus hoặc phương tiện công cộng. `;
  }

  el.innerHTML = reason;
}

/**
 * ==============================================================
 * 4. TIỆN ÍCH: MÃ QR SVG & CANVAS HÀNG ĐỢI
 * ==============================================================
 */

function renderQrCodeSvg(containerId, hash) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <svg width="68" height="68" viewBox="0 0 100 100" fill="#000">
      <rect width="100" height="100" fill="#fff"/>
      <rect x="10" y="10" width="24" height="24" fill="#000"/>
      <rect x="14" y="14" width="16" height="16" fill="#fff"/>
      <rect x="18" y="18" width="8" height="8" fill="#000"/>

      <rect x="66" y="10" width="24" height="24" fill="#000"/>
      <rect x="70" y="14" width="16" height="16" fill="#fff"/>
      <rect x="74" y="18" width="8" height="8" fill="#000"/>

      <rect x="10" y="66" width="24" height="24" fill="#000"/>
      <rect x="14" y="70" width="16" height="16" fill="#fff"/>
      <rect x="18" y="74" width="8" height="8" fill="#000"/>

      <rect x="42" y="15" width="6" height="6"/>
      <rect x="52" y="15" width="6" height="6"/>
      <rect x="42" y="25" width="6" height="6"/>
      <rect x="42" y="38" width="8" height="8"/>
      <rect x="54" y="38" width="8" height="8"/>
      <rect x="15" y="42" width="6" height="6"/>
      <rect x="25" y="42" width="6" height="6"/>
      <rect x="70" y="45" width="6" height="6"/>
      <rect x="80" y="45" width="6" height="6"/>
      <rect x="42" y="55" width="6" height="6"/>
      <rect x="52" y="55" width="6" height="6"/>
      <rect x="62" y="55" width="6" height="6"/>
      <rect x="45" y="72" width="8" height="8"/>
      <rect x="60" y="72" width="8" height="8"/>
      <rect x="75" y="72" width="8" height="8"/>
      <rect x="45" y="85" width="8" height="8"/>
      <rect x="65" y="85" width="8" height="8"/>
    </svg>
  `;
}

function startQueueCanvas() {
  const canvas = document.getElementById('queueCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let queue = [];
  let serverCars = [null, null];
  let carCounter = 1;

  setInterval(() => {
    if (Math.random() < 0.25 && queue.length < 12) {
      queue.push({
        id: carCounter++,
        x: 30,
        y: 65,
        color: ['#38bdf8', '#34d399', '#fbbf24', '#f472b6'][Math.floor(Math.random() * 4)]
      });
    }

    for (let i = 0; i < 2; i++) {
      if (!serverCars[i] && queue.length > 0) {
        const nextCar = queue.shift();
        nextCar.targetX = 520;
        nextCar.targetY = i === 0 ? 45 : 85;
        serverCars[i] = { ...nextCar, timer: 14 };
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 20, canvas.width, 95);

    ctx.strokeStyle = '#334155';
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 65);
    ctx.lineTo(480, 65);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#2563eb';
    ctx.fillRect(500, 30, 14, 30);
    ctx.fillRect(500, 75, 14, 30);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillText('LÀN 1 (QR)', 485, 24);
    ctx.fillText('LÀN 2 (QR)', 485, 120);

    ctx.fillStyle = '#065f46';
    ctx.fillRect(580, 25, 270, 85);
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText('🅿️ KHU VỰC BÃI XE TRONG TRƯỜNG (50 CHỖ)', 595, 70);

    queue.forEach((car, index) => {
      const destX = 460 - index * 32;
      car.x += (destX - car.x) * 0.25;
      drawBike(ctx, car.x, car.y, car.color, car.id);
    });

    for (let i = 0; i < 2; i++) {
      const sc = serverCars[i];
      if (sc) {
        sc.timer--;
        drawBike(ctx, sc.targetX, sc.targetY, sc.color, sc.id);

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.strokeRect(sc.targetX - 5, sc.targetY - 12, 26, 24);

        if (sc.timer <= 0) {
          serverCars[i] = null;
        }
      }
    }
  }, 100);
}

function drawBike(ctx, x, y, color, id) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x - 5, y + 5, 3, 0, Math.PI * 2);
  ctx.arc(x + 5, y + 5, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px monospace';
  ctx.fillText(id % 100, x - 4, y + 3);
}

/**
 * ==============================================================
 * 4. QUẢN LÝ ĐỔI MẬT KHẨU SINH VIÊN
 * ==============================================================
 */

function openChangePasswordModal(isFirstLogin = false) {
  const modal = document.getElementById('changePasswordModal');
  const alertFirst = document.getElementById('firstLoginAlert');
  const btnSkip = document.getElementById('btnSkipChangePwd');
  const btnClose = document.getElementById('btnCloseChangePwd');
  const alertBox = document.getElementById('changePwdAlert');

  if (alertBox) {
    alertBox.style.display = 'none';
    alertBox.className = 'login-error-alert';
  }

  if (isFirstLogin) {
    if (alertFirst) alertFirst.style.display = 'block';
    if (btnSkip) btnSkip.style.display = 'inline-block';
    if (btnClose) btnClose.style.display = 'none';
  } else {
    if (alertFirst) alertFirst.style.display = 'none';
    if (btnSkip) btnSkip.style.display = 'none';
    if (btnClose) btnClose.style.display = 'block';
  }

  const curInput = document.getElementById('pwdCurrent');
  if (curInput) {
    curInput.value = isFirstLogin ? '12345678' : '';
  }
  document.getElementById('pwdNew').value = '';
  document.getElementById('pwdConfirm').value = '';

  if (modal) modal.style.display = 'flex';
}

function closeChangePasswordModal() {
  const modal = document.getElementById('changePasswordModal');
  if (modal) modal.style.display = 'none';
}

async function handleChangePasswordSubmit(event) {
  event.preventDefault();
  if (!currentUser || !currentUser.studentId) return;

  const currentPassword = document.getElementById('pwdCurrent').value.trim();
  const newPassword = document.getElementById('pwdNew').value.trim();
  const confirmPassword = document.getElementById('pwdConfirm').value.trim();
  const alertBox = document.getElementById('changePwdAlert');

  alertBox.style.display = 'none';

  if (newPassword.length < 6) {
    alertBox.textContent = 'Mật khẩu mới phải có tối thiểu 6 ký tự!';
    alertBox.style.display = 'block';
    return;
  }

  if (newPassword !== confirmPassword) {
    alertBox.textContent = 'Mật khẩu xác nhận không khớp!';
    alertBox.style.display = 'block';
    return;
  }

  if (newPassword === currentPassword) {
    alertBox.textContent = 'Mật khẩu mới không được trùng với mật khẩu hiện tại!';
    alertBox.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/student/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: currentUser.studentId,
        currentPassword,
        newPassword
      })
    });
    const result = await res.json();

    if (result.success) {
      alertBox.className = 'alert-box';
      alertBox.style.backgroundColor = '#ecfdf5';
      alertBox.style.color = '#065f46';
      alertBox.style.border = '1px solid #a7f3d0';
      alertBox.textContent = `✔ ${result.message}`;
      alertBox.style.display = 'block';

      currentUser.mustChangePassword = false;
      sessionStorage.setItem('smartpark_user', JSON.stringify(currentUser));

      setTimeout(() => {
        closeChangePasswordModal();
      }, 1500);
    } else {
      alertBox.className = 'login-error-alert';
      alertBox.textContent = result.message || 'Không thể đổi mật khẩu!';
      alertBox.style.display = 'block';
    }
  } catch (err) {
    alertBox.textContent = 'Lỗi kết nối máy chủ! Vui lòng thử lại.';
    alertBox.style.display = 'block';
  }
}
