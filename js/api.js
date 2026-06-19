// ============================================================
// طبقة الاتصال بـ Google Apps Script
// ============================================================

var API = (function () {

  function _call(params) {
    // التحقق من ضبط الرابط
    if (!CONFIG.API_URL || CONFIG.API_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
      return Promise.resolve({ ok: false, error: 'api_not_configured' });
    }

    var token = Auth ? Auth.getToken() : null;
    if (token) params.token = token;

    var url = CONFIG.API_URL + '?' + Object.keys(params).map(function(k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]));
    }).join('&');

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var tid = controller ? setTimeout(function(){ controller.abort(); }, 60000) : null;
    return fetch(url, { redirect: 'follow', signal: controller ? controller.signal : undefined })
      .then(function(r) {
        if (tid) clearTimeout(tid);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(data) {
        if (data && data.error === 'session_expired') {
          // انتهت الجلسة — تسجيل خروج تلقائي
          if (typeof Auth !== 'undefined') Auth.logout();
          if (typeof App   !== 'undefined') App.showSessionExpired();
        }
        return data;
      })
      .catch(function(err) {
        if (tid) clearTimeout(tid);
        var isAbort = err && err.name === 'AbortError';
        console.warn('[API] خطأ في الاتصال:', err && err.message || 'network_error');
        return { ok: false, error: isAbort ? 'timeout' : 'network_error' };
      });
  }

  // ---- المصادقة ----
  function login(empId, password) {
    return _call({ action:'login', empId: empId, password: password });
  }

  function changePassword(newPassword, currentPassword) {
    var p = { action:'changePassword', newPassword: newPassword };
    if (currentPassword) p.currentPassword = currentPassword;
    return _call(p);
  }

  function resetPassword(empId, shift) {
    return _call({ action:'resetPassword', empId: empId, shift: shift });
  }

  // ---- الجدول ----
  function getSchedule(year, month) {
    return _call({ action:'getSchedule', year: year, month: month });
  }

  // ---- الإعدادات ----
  function getSettings() {
    return _call({ action:'getSettings' });
  }

  function updateSettings(settings, descs) {
    var p = { action:'updateSettings', settings: JSON.stringify(settings) };
    if (descs) p.descs = JSON.stringify(descs);
    return _call(p);
  }

  // ---- الموظفون ----
  function getEmployees() {
    return _call({ action:'getEmployees' });
  }

  function getEmployee(empId) {
    var p = { action:'getEmployee' };
    if (empId) p.empId = empId;
    return _call(p);
  }

  function addEmployee(employee) {
    return _call({ action:'addEmployee', employee: JSON.stringify(employee) });
  }

  function updateEmployee(empId, updates) {
    return _call({ action:'updateEmployee', empId: empId, updates: JSON.stringify(updates) });
  }

  // ---- جهات الاتصال للواتساب ----
  function getShiftContacts(shift) {
    var p = { action:'getShiftContacts' };
    if (shift) p.shift = shift;
    return _call(p);
  }

  // ---- المناطق والمراكز ----
  function getRegions(empId) {
    var p = { action:'getRegions' };
    if (empId) p.empId = empId;
    return _call(p);
  }

  function updateRegion(empId, updates) {
    return _call({ action:'updateRegion', empId: empId, updates: JSON.stringify(updates) });
  }

  // ---- العدد والمقاسات ----
  function getEquipment(empId) {
    var p = { action:'getEquipment' };
    if (empId) p.empId = empId;
    return _call(p);
  }

  function updateEquipment(empId, updates) {
    return _call({ action:'updateEquipment', empId: empId, updates: JSON.stringify(updates) });
  }

  // ---- الإجازات (أرصدة) ----
  function getLeaves(empId) {
    var p = { action:'getLeaves' };
    if (empId) p.empId = empId;
    return _call(p);
  }

  function updateLeaveBalance(empId, updates, firstTime) {
    return _call({ action:'updateLeaveBalance', empId: empId,
                   updates: JSON.stringify(updates), firstTime: firstTime ? '1' : '0' });
  }

  // ---- طلبات الإجازات ----
  function getRegionInfo(startDate, endDate, empId) {
    var p = { action:'getRegionInfo', startDate: startDate, endDate: endDate };
    if (empId) p.empId = empId;
    return _call(p);
  }

  function checkRegionCapacity(startDate, endDate, empId, excludeNo) {
    var p = { action:'getRegionCapacity', startDate: startDate, endDate: endDate };
    if (empId) p.empId = empId;
    if (excludeNo) p.excludeNo = excludeNo;
    return _call(p);
  }

  function getLeaveReqs(opts) {
    var p = { action:'getLeaveReqs' };
    if (opts) { if (opts.status) p.status = opts.status;
                if (opts.from)   p.from   = opts.from;
                if (opts.to)     p.to     = opts.to; }
    return _call(p);
  }

  function submitLeave(data) {
    return _call(Object.assign({ action:'submitLeave' }, data));
  }

  function reviewLeave(no, status, notes) {
    return _call({ action:'reviewLeave', no:no, status:status, notes: notes||'' });
  }

  function cancelLeave(no) {
    return _call({ action:'cancelLeave', no:no });
  }

  function editLeave(no, updates) {
    return _call(Object.assign({ action:'editLeave', no:no }, updates));
  }

  // ---- طلبات العمل الإضافي ----
  function getOvertimeReqs(opts) {
    var p = { action:'getOvertimeReqs' };
    if (opts) { if (opts.status) p.status = opts.status;
                if (opts.from)   p.from   = opts.from;
                if (opts.to)     p.to     = opts.to;
                if (opts.empId)  p.empId  = opts.empId; }
    return _call(p);
  }

  function submitOvertime(data) {
    return _call(Object.assign({ action:'submitOvertime' }, data));
  }

  function reviewOvertime(no, status, notes) {
    return _call({ action:'reviewOvertime', no:no, status:status, notes: notes||'' });
  }

  function reviewAndSendOvertime(no, notes) {
    return _call({ action:'reviewAndSendOvertime', no:no, notes: notes||'' });
  }

  function cancelOvertime(no) {
    return _call({ action:'cancelOvertime', no:no });
  }

  function editOvertime(no, updates) {
    return _call(Object.assign({ action:'editOvertime', no:no }, updates));
  }

  function sendToCoordinator(no) {
    return _call({ action:'sendToCoordinator', no:no });
  }

  function coordinatorAction(no, coordAction, notes) {
    return _call({ action:'coordinatorAction', no:no, coordAction:coordAction, notes: notes||'' });
  }

  function confirmReceipt(no, received) {
    return _call({ action:'confirmReceipt', no:no, received: received ? '1' : '0' });
  }

  // ---- التنقل بين الورديات ----
  function transferEmployee(empId, newShift, notes, newData) {
    return _call({
      action: 'transferEmployee',
      empId: empId, newShift: newShift, notes: notes || '',
      newRegion: (newData && newData.region) || '',
      newCenter: (newData && newData.center) || '',
      newCar:    (newData && newData.car)    || ''
    });
  }

  function getTransfers() {
    return _call({ action:'getTransfers' });
  }

  // ---- الإشعارات ----
  function getNotifications() {
    return _call({ action:'getNotifications' });
  }

  function markNotifRead(no) {
    return _call({ action:'markNotifRead', no:no });
  }

  function deleteNotifs(nos) {
    return _call({ action:'deleteNotif', nos: JSON.stringify(nos) });
  }

  // ---- لوحة التحكم ----
  function getDashboard() {
    return _call({ action:'getDashboard' });
  }

  // ---- السجل ----
  function getLogs(opts) {
    var p = { action:'getLogs' };
    if (opts) { if (opts.from) p.from = opts.from; if (opts.to) p.to = opts.to; }
    return _call(p);
  }

  // ---- استهلاك API ----
  function getApiUsage() {
    return _call({ action:'getApiUsage' });
  }

  // ---- إجازات سنوية ----
  function yearlyLeaveReset() {
    return _call({ action:'yearlyLeaveReset' });
  }

  // ---- العرض الشامل ----
  function buildComprehensiveView() {
    return _call({ action:'buildComprehensiveView' });
  }

  // ---- رسائل واتساب من جدول الإعدادات ----
  function getWaMessages() {
    return fetch(CONFIG.API_URL + '?action=getWaMessages', { redirect: 'follow' })
      .then(function(r) { return r.json(); })
      .catch(function() { return { ok: false }; });
  }

  // ---- رمز الصلاحية الشخصي ----
  function verifyRoleCode(code) {
    return _call({ action:'verifyRoleCode', code: code });
  }

  function setRoleCode(code) {
    return _call({ action:'setRoleCode', code: code });
  }

  return {
    login, changePassword, resetPassword,
    getSchedule,
    getSettings, updateSettings,
    verifyRoleCode, setRoleCode,
    getEmployees, getEmployee, addEmployee, updateEmployee,
    getShiftContacts,
    getRegions, updateRegion,
    getEquipment, updateEquipment,
    getLeaves, updateLeaveBalance,
    getRegionInfo, checkRegionCapacity,
    getLeaveReqs, submitLeave, reviewLeave, cancelLeave, editLeave,
    getOvertimeReqs, submitOvertime, reviewOvertime, reviewAndSendOvertime, cancelOvertime, editOvertime,
    sendToCoordinator, coordinatorAction, confirmReceipt,
    transferEmployee, getTransfers,
    getNotifications, markNotifRead, deleteNotifs,
    getDashboard, getLogs, getApiUsage,
    yearlyLeaveReset, buildComprehensiveView, getWaMessages
  };
})();
