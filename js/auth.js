// ============================================================
// إدارة المصادقة والجلسات والصلاحيات
// ============================================================

var Auth = (function () {

  var _user         = null;
  var _token        = null;
  var _activeRole   = null;  // الصلاحية الفعّالة (قد تختلف عن role الموظف)
  var _adminMode    = false; // وضع الإدارة مفعّل

  // ============================================================
  // تسجيل الدخول
  // ============================================================

  function login(empId, password) {
    return API.login(empId, password).then(function(res) {
      if (res.ok) {
        _user  = res.user;
        _token = res.token;
        _activeRole = res.user.role;
        _adminMode  = false;
        _save();
      }
      return res;
    });
  }

  function logout() {
    _user = null; _token = null; _activeRole = null; _adminMode = false;
    localStorage.removeItem('sm_session');
    sessionStorage.removeItem('sm_mode');
  }

  function restore() {
    try {
      var raw = localStorage.getItem('sm_session');
      if (!raw) return false;
      var s = JSON.parse(raw);
      if (!s.token || !s.user) return false;
      if (Date.now() - s.ts > 86400000) { logout(); return false; }
      _user       = s.user;
      _token      = s.token;
      _activeRole = s.activeRole || s.user.role;
      _adminMode  = !!(sessionStorage.getItem('sm_mode') === 'admin');
      return true;
    } catch(e) { return false; }
  }

  function _save() {
    localStorage.setItem('sm_session', JSON.stringify({
      user: _user, token: _token, activeRole: _activeRole, ts: Date.now()
    }));
  }

  // ============================================================
  // نظام الرمز الثانوي لتفعيل الصلاحيات العليا
  // ============================================================

  function activateElevatedRole(code) {
    return API.getSettings().then(function(res) {
      if (!res.ok) return { ok: false, error: 'forbidden' };
      var cfg = res.data;

      var targetRole = null;
      var storedCode = null;

      if (_user.role === 'مدير') {
        storedCode = cfg.admin_code;
        targetRole = 'مدير';
      } else if (_user.role === 'مشرف') {
        storedCode = cfg.supervisor_code;
        targetRole = 'مشرف';
      } else if (_user.role === 'اداري') {
        storedCode = cfg.viewer_code;
        targetRole = 'اداري';
      }

      if (!storedCode || !targetRole)
        return { ok: false, error: 'no_elevated_role' };
      if (String(code) !== String(storedCode))
        return { ok: false, error: 'invalid_code' };

      _adminMode  = true;
      _activeRole = targetRole;
      sessionStorage.setItem('sm_mode', 'admin');
      _save();
      return { ok: true, role: targetRole };
    });
  }

  function deactivateElevatedRole() {
    _adminMode  = false;
    _activeRole = 'موظف';
    sessionStorage.removeItem('sm_mode');
    _save();
  }

  function changePassword(newPassword) {
    return API.changePassword(newPassword).then(function(res) {
      return res;
    });
  }

  // ============================================================
  // استعلامات الحالة
  // ============================================================

  function getUser()          { return _user; }
  function getToken()         { return _token; }
  function getEffectiveRole() { return _adminMode ? _activeRole : (_user ? _user.role : ''); }
  function getBaseRole()      { return _user ? _user.role : ''; }
  function isAdminMode()      { return _adminMode; }

  function isAdmin()      { return getEffectiveRole() === 'مدير'; }
  function isSupervisor() { return getEffectiveRole() === 'مشرف'; }
  function isViewer()     { return getEffectiveRole() === 'اداري'; }
  function isEmployee()   { return getEffectiveRole() === 'موظف'; }

  function canManage() {
    var r = getEffectiveRole();
    return r === 'مدير' || r === 'مشرف' || r === 'اداري';
  }

  function canElevate() {
    if (!_user) return false;
    return _user.role === 'مدير' || _user.role === 'مشرف' || _user.role === 'اداري';
  }

  function hasElevatedPanel() {
    return canElevate() && _adminMode;
  }

  function getShift() {
    return _user ? _user.shift : '';
  }

  return {
    login, logout, restore,
    activateElevatedRole, deactivateElevatedRole,
    changePassword,
    getUser, getToken, getEffectiveRole, getBaseRole,
    isAdminMode, isAdmin, isSupervisor, isViewer, isEmployee,
    canManage, canElevate, hasElevatedPanel, getShift
  };
})();
