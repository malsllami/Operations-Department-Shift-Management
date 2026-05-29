// ============================================================
// طبقة الاتصال بـ Google Apps Script
// ============================================================

var API = (function () {

  function _call(params) {
    var token = Auth ? Auth.getToken() : null;
    if (token) params.token = token;

    var url = CONFIG.API_URL + '?' + Object.keys(params).map(function(k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]));
    }).join('&');

    return fetch(url, { redirect: 'follow' })
      .then(function(r) { return r.json(); })
      .catch(function() { return { ok: false, error: 'network_error' }; });
  }

  // ---- المصادقة ----
  function login(empId, password) {
    return _call({ action:'login', empId: empId, password: password });
  }

  function changePassword(newPassword) {
    return _call({ action:'changePassword', newPassword: newPassword });
  }

  // ---- الجدول ----
  function getSchedule(year, month) {
    return _call({ action:'getSchedule', year: year, month: month });
  }

  // ---- الإعدادات ----
  function getSettings() {
    return _call({ action:'getSettings' });
  }

  function updateSettings(settings) {
    return _call({ action:'updateSettings', settings: JSON.stringify(settings) });
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

  // ---- طلبات العمل الإضافي ----
  function getOvertimeReqs(opts) {
    var p = { action:'getOvertimeReqs' };
    if (opts) { if (opts.status) p.status = opts.status;
                if (opts.from)   p.from   = opts.from;
                if (opts.to)     p.to     = opts.to; }
    return _call(p);
  }

  function submitOvertime(data) {
    return _call(Object.assign({ action:'submitOvertime' }, data));
  }

  function reviewOvertime(no, status, notes) {
    return _call({ action:'reviewOvertime', no:no, status:status, notes: notes||'' });
  }

  function sendToCoordinator(no) {
    return _call({ action:'sendToCoordinator', no:no });
  }

  function coordinatorAction(no, action, notes) {
    return _call({ action:'coordinatorAction', no:no, action:action, notes: notes||'' });
  }

  function confirmReceipt(no, received) {
    return _call({ action:'confirmReceipt', no:no, received: received ? '1' : '0' });
  }

  // ---- التنقل بين الورديات ----
  function transferEmployee(empId, newShift, notes) {
    return _call({ action:'transferEmployee', empId:empId, newShift:newShift, notes: notes||'' });
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

  return {
    login, changePassword,
    getSchedule,
    getSettings, updateSettings,
    getEmployees, getEmployee, addEmployee, updateEmployee,
    getRegions, updateRegion,
    getEquipment, updateEquipment,
    getLeaves, updateLeaveBalance,
    getLeaveReqs, submitLeave, reviewLeave,
    getOvertimeReqs, submitOvertime, reviewOvertime,
    sendToCoordinator, coordinatorAction, confirmReceipt,
    transferEmployee, getTransfers,
    getNotifications, markNotifRead,
    getDashboard, getLogs, getApiUsage,
    yearlyLeaveReset, buildComprehensiveView
  };
})();
