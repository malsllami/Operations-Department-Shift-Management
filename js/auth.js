// ============================================================
// إدارة المصادقة والجلسات والصلاحيات
// ============================================================

var Auth = (function () {

  var _user            = null;
  var _token           = null;
  var _activeRole      = null;
  var _adminMode       = false;
  var _forceChange     = false;   // يجب تغيير كلمة المرور قبل الدخول
  var _forceRoleCode   = false;   // يجب تعيين رمز الصلاحية الشخصي قبل الدخول

  // ============================================================
  // تسجيل الدخول
  // ============================================================

  function login(empId, password) {
    return API.login(empId, password).then(function(res) {
      if (res.ok) {
        _user        = res.user;
        _token       = res.token;
        _activeRole  = res.user.role;
        _adminMode   = false;
        _forceChange = !!res.force_change;

          _forceRoleCode = !!res.force_set_role_code;

        if (_forceChange || _forceRoleCode) {
          // لا نحفظ الجلسة حتى يُكمل الإعداد الإلزامي
        } else {
          _save();
        }
      }
      return res;
    });
  }

  function logout() {
    _user = null; _token = null; _activeRole = null;
    _adminMode = false; _forceChange = false; _forceRoleCode = false;
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
      _user        = s.user;
      _token       = s.token;
      _activeRole  = s.activeRole || s.user.role;
      _adminMode   = !!(sessionStorage.getItem('sm_mode') === 'admin');
      _forceChange = false;  // الجلسات المحفوظة لا تحتاج تغيير رقم سري
      return true;
    } catch(e) { return false; }
  }

  function _save() {
    localStorage.setItem('sm_session', JSON.stringify({
      user: _user, token: _token, activeRole: _activeRole, ts: Date.now()
    }));
  }

  // ============================================================
  // تغيير كلمة المرور
  // ============================================================

  function changePassword(newPassword, currentPassword) {
    return API.changePassword(newPassword, currentPassword).then(function(res) {
      if (res.ok) {
        _forceChange = false;
        if (!_forceRoleCode) _save();
      }
      return res;
    });
  }

  // ============================================================
  // تعيين رمز الصلاحية الشخصي (مشرف/مدير/اداري)
  // ============================================================
  function setRoleCode(code) {
    return API.setRoleCode(code).then(function(res) {
      if (res.ok) {
        _forceRoleCode = false;
        _save();
      }
      return res;
    });
  }

  function mustSetRoleCode() { return _forceRoleCode; }

  // ============================================================
  // نظام الرمز الثانوي لتفعيل الصلاحيات العليا
  // ============================================================

  function activateElevatedRole(code) {
    return API.verifyRoleCode(code).then(function(res) {
      if (!res.ok) return res;
      _adminMode  = true;
      _activeRole = res.role;
      sessionStorage.setItem('sm_mode', 'admin');
      _save();
      return { ok: true, role: res.role };
    });
  }

  // التبديل بين الوضعين — يتطلب الرمز في كلا الاتجاهين
  function toggleElevatedRole(code) {
    return API.verifyRoleCode(code).then(function(res) {
      if (!res.ok) return res;
      if (_adminMode) {
        // من مشرف/مدير → موظف
        _adminMode  = false;
        _activeRole = null;
        sessionStorage.removeItem('sm_mode');
      } else {
        // من موظف → مشرف/مدير
        _adminMode  = true;
        _activeRole = res.role;
        sessionStorage.setItem('sm_mode', 'admin');
      }
      _save();
      return { ok: true, role: _adminMode ? _activeRole : 'موظف', adminMode: _adminMode };
    });
  }

  function deactivateElevatedRole() {
    _adminMode  = false;
    _activeRole = null;
    sessionStorage.removeItem('sm_mode');
    _save();
  }

  // ============================================================
  // استعلامات الحالة
  // ============================================================

  function getUser()          { return _user; }
  function getToken()         { return _token; }
  function getEffectiveRole() { return _adminMode ? _activeRole : 'موظف'; }
  function getBaseRole()      { return _user ? _user.role : ''; }
  function isAdminMode()      { return _adminMode; }
  function mustChangePass()   { return _forceChange; }

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

  function hasElevatedPanel() { return canElevate() && _adminMode; }
  function getShift()         { return _user ? _user.shift : ''; }

  return {
    login, logout, restore,
    changePassword, setRoleCode, mustSetRoleCode,
    activateElevatedRole, toggleElevatedRole, deactivateElevatedRole,
    getUser, getToken, getEffectiveRole, getBaseRole,
    isAdminMode, mustChangePass,
    isAdmin, isSupervisor, isViewer, isEmployee,
    canManage, canElevate, hasElevatedPanel, getShift
  };
})();
