// ============================================================
// المتحكم الرئيسي — توجيه وتنقل وشاشة الدخول
// ============================================================

var App = (function () {

  var _view    = null;
  var _history = [];

  // ============================================================
  // تهيئة التطبيق
  // ============================================================

  function init() {
    if (Auth.restore()) {
      _showApp();
      navigate('dashboard');
    } else {
      _showLogin();
    }
  }

  // ============================================================
  // شاشة الدخول
  // ============================================================

  function _showLogin() {
    document.getElementById('screen-login').style.display = 'flex';
    document.getElementById('screen-app').style.display   = 'none';
    _renderLoginForm();
  }

  function _showApp() {
    document.getElementById('screen-login').style.display = 'none';
    document.getElementById('screen-app').style.display   = 'flex';
    _buildShell();
  }

  function _renderLoginForm() {
    var el = document.getElementById('login-form-container');
    if (!el) return;
    el.innerHTML =
      '<form id="login-form" novalidate>' +
        '<div class="login-field">' +
          '<label>الرقم الوظيفي</label>' +
          '<input type="text" id="l-empid" class="login-input" placeholder="أدخل رقمك الوظيفي" autocomplete="username" required>' +
        '</div>' +
        '<div class="login-field">' +
          '<label>كلمة المرور</label>' +
          '<div class="pw-wrap">' +
            '<input type="password" id="l-pass" class="login-input" placeholder="••••••" autocomplete="current-password" required>' +
            '<button type="button" class="pw-eye" onclick="App.togglePw(\'l-pass\',this)">👁</button>' +
          '</div>' +
        '</div>' +
        '<div id="l-err" class="login-error" style="display:none"></div>' +
        '<button type="submit" class="btn-login" id="l-btn">دخول</button>' +
      '</form>';

    document.getElementById('login-form').onsubmit = function(e) {
      e.preventDefault();
      var empId = document.getElementById('l-empid').value.trim();
      var pass  = document.getElementById('l-pass').value;
      var errEl = document.getElementById('l-err');
      var btn   = document.getElementById('l-btn');

      if (!empId || !pass) { errEl.textContent = 'يرجى إدخال الرقم الوظيفي وكلمة المرور'; errEl.style.display = 'block'; return; }
      btn.disabled = true; btn.textContent = 'جارٍ الدخول...';
      errEl.style.display = 'none';

      Auth.login(empId, pass).then(function(res) {
        btn.disabled = false; btn.textContent = 'دخول';
        if (res.ok) {
          if (res.force_change) {
            _renderChangePassForm();
          } else {
            _showApp(); navigate('dashboard');
          }
        } else {
          var errs = { invalid_credentials:'رقم وظيفي أو كلمة مرور غير صحيحة', network_error:'خطأ في الاتصال — تحقق من الإنترنت' };
          errEl.textContent = errs[res.error] || 'حدث خطأ: ' + res.error;
          errEl.style.display = 'block';
        }
      });
    };
  }

  function _renderChangePassForm() {
    var el = document.getElementById('login-form-container');
    if (!el) return;
    el.innerHTML =
      '<div class="change-pass-notice">🔒 يجب تغيير كلمة المرور الافتراضية قبل المتابعة</div>' +
      '<form id="chpass-form" novalidate>' +
        '<div class="login-field"><label>كلمة المرور الجديدة</label>' +
          '<div class="pw-wrap"><input type="password" id="cp-new" class="login-input" placeholder="6 أحرف على الأقل" required>' +
          '<button type="button" class="pw-eye" onclick="App.togglePw(\'cp-new\',this)">👁</button></div>' +
        '</div>' +
        '<div class="login-field"><label>تأكيد كلمة المرور</label>' +
          '<div class="pw-wrap"><input type="password" id="cp-confirm" class="login-input" placeholder="••••••" required>' +
          '<button type="button" class="pw-eye" onclick="App.togglePw(\'cp-confirm\',this)">👁</button></div>' +
        '</div>' +
        '<div id="cp-err" class="login-error" style="display:none"></div>' +
        '<button type="submit" class="btn-login" id="cp-btn">تغيير وحفظ</button>' +
      '</form>';

    document.getElementById('chpass-form').onsubmit = function(e) {
      e.preventDefault();
      var newPass = document.getElementById('cp-new').value;
      var confirm = document.getElementById('cp-confirm').value;
      var errEl   = document.getElementById('cp-err');
      var btn     = document.getElementById('cp-btn');

      if (newPass.length < 6) { errEl.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'; errEl.style.display='block'; return; }
      if (newPass !== confirm) { errEl.textContent = 'كلمتا المرور غير متطابقتين'; errEl.style.display='block'; return; }

      btn.disabled = true; btn.textContent = 'جارٍ الحفظ...';
      errEl.style.display = 'none';

      Auth.changePassword(newPass).then(function(res) {
        btn.disabled = false; btn.textContent = 'تغيير وحفظ';
        if (res.ok) { _showApp(); navigate('dashboard'); }
        else {
          var errs = { password_too_short:'كلمة المرور قصيرة (6 أحرف كحد أدنى)', password_same_as_default:'لا يمكن استخدام كلمة المرور الافتراضية' };
          errEl.textContent = errs[res.error] || 'حدث خطأ';
          errEl.style.display = 'block';
        }
      });
    };
  }

  // ============================================================
  // هيكل التطبيق
  // ============================================================

  function _buildShell() {
    var user = Auth.getUser();
    var role = Auth.getEffectiveRole();

    // رأس الصفحة
    var headerUser = document.getElementById('header-user');
    if (headerUser) {
      headerUser.innerHTML = '<span class="header-name">' + (user ? user.name : '') + '</span>' +
        '<span class="header-role role-' + _roleClass(role) + '">' + role + '</span>';
    }

    // الشريط الجانبي
    _buildSidebar(role);

    // زر وضع الإدارة
    var modeBtn = document.getElementById('toggle-mode-btn');
    if (modeBtn) {
      if (Auth.canElevate()) {
        modeBtn.style.display = 'flex';
        _updateModeBtn(modeBtn);
        modeBtn.onclick = function() { _toggleMode(); };
      } else {
        modeBtn.style.display = 'none';
      }
    }

    // تسجيل الخروج
    var logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.onclick = function() {
      if (confirm('تأكيد تسجيل الخروج؟')) { Auth.logout(); _showLogin(); }
    };

    // شارة الإشعارات
    loadNotifBadge();
  }

  function _buildSidebar(role) {
    var nav = document.getElementById('sidebar-nav');
    if (!nav) return;

    var items = [
      { id:'dashboard',    icon:'🏠', label:'الرئيسية',            show: true },
      { id:'calendar',     icon:'📅', label:'تقويم الورديات',      show: true },
      { id:'employees',    icon:'👥', label:'الموظفون',            show: role==='مدير'||role==='مشرف'||role==='اداري' },
      { id:'leaves',       icon:'🏖️', label:'طلبات الإجازات',     show: true },
      { id:'overtime',     icon:'⏱️', label:'العمل الإضافي',       show: true },
      { id:'transfers',    icon:'🔀', label:'التنقلات',            show: role==='مدير'||role==='مشرف' },
      { id:'export',       icon:'📊', label:'التصدير',             show: role==='مدير'||role==='اداري' },
      { id:'notifications',icon:'🔔', label:'الإشعارات',          show: true },
      { id:'profile',      icon:'👤', label:'ملفي الشخصي',         show: true },
      { id:'settings',     icon:'⚙️', label:'الإعدادات',           show: role==='مدير' }
    ];

    nav.innerHTML = items.filter(function(i) { return i.show; }).map(function(item) {
      return '<button class="nav-item" data-view="' + item.id + '">' +
        '<span class="nav-icon">' + item.icon + '</span>' +
        '<span class="nav-label">' + item.label + '</span>' +
        (item.id === 'notifications' ? '<span class="notif-dot" id="notif-dot"></span>' : '') +
      '</button>';
    }).join('');

    nav.querySelectorAll('.nav-item').forEach(function(btn) {
      btn.onclick = function() { navigate(this.dataset.view); };
    });
  }

  function _updateModeBtn(btn) {
    var active = Auth.isAdminMode();
    btn.textContent = active ? '👤 وضع الموظف' : '🛡️ وضع الإدارة';
    btn.title = active ? 'الانتقال لواجهة الموظف' : 'تفعيل لوحة الإدارة';
  }

  function _toggleMode() {
    if (Auth.isAdminMode()) {
      Auth.deactivateElevatedRole();
      _buildShell();
      navigate('dashboard');
      toast('تم التبديل لوضع الموظف', 'info');
    } else {
      // طلب الرمز الثانوي
      _elevateModal();
    }
  }

  function _elevateModal() {
    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-box">' +
      '<h3>🛡️ تفعيل لوحة الإدارة</h3>' +
      '<p>أدخل رمز الصلاحية الخاص بك</p>' +
      '<div class="pw-wrap"><input type="password" id="elev-code" class="form-input" placeholder="رمز الصلاحية">' +
        '<button type="button" class="pw-eye" onclick="App.togglePw(\'elev-code\',this)">👁</button>' +
      '</div>' +
      '<div id="elev-err" class="form-error" style="display:none"></div>' +
      '<div class="form-actions">' +
        '<button class="btn-primary" id="elev-ok">تأكيد</button>' +
        '<button class="btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">إلغاء</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(modal);

    modal.querySelector('#elev-ok').onclick = function() {
      var code  = modal.querySelector('#elev-code').value;
      var errEl = modal.querySelector('#elev-err');
      var btn   = this;
      btn.disabled = true; btn.textContent = 'جارٍ التحقق...';
      errEl.style.display = 'none';

      Auth.activateElevatedRole(code).then(function(res) {
        btn.disabled = false; btn.textContent = 'تأكيد';
        if (res.ok) {
          modal.remove();
          _buildShell();
          navigate('dashboard');
          toast('تم تفعيل لوحة ' + res.role, 'success');
        } else {
          errEl.textContent = res.error === 'invalid_code' ? 'الرمز غير صحيح' : 'تعذّر التحقق';
          errEl.style.display = 'block';
        }
      });
    };
  }

  // ============================================================
  // التوجيه
  // ============================================================

  function navigate(viewName, params) {
    if (_view) _history.push(_view);
    _view = viewName;
    _render(viewName, params);
    _updateActiveNav(viewName);
  }

  function goBack() {
    if (_history.length > 0) {
      var prev = _history.pop(); _view = prev;
      _render(prev); _updateActiveNav(prev);
    } else { navigate('dashboard'); }
  }

  function _updateActiveNav(viewName) {
    document.querySelectorAll('.nav-item').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
  }

  function _render(viewName, params) {
    var main = document.getElementById('main-content');
    if (!main) return;

    var role   = Auth.getEffectiveRole();
    var titles = {
      dashboard:'الرئيسية', calendar:'تقويم الورديات',
      employees:'الموظفون', 'employee-form':'بيانات الموظف', 'employee-view':'ملف الموظف',
      leaves:'طلبات الإجازات', 'leave-form':'طلب إجازة',
      overtime:'العمل الإضافي', 'overtime-form':'طلب عمل إضافي',
      transfers:'التنقلات بين الورديات', notifications:'الإشعارات',
      export:'تصدير البيانات', settings:'الإعدادات', profile:'ملفي الشخصي'
    };

    main.innerHTML = '<div class="view-header"><h1 class="view-title">' + (titles[viewName]||viewName) + '</h1></div>' +
                     '<div id="view-content" class="view-body"></div>';

    switch (viewName) {
      case 'dashboard':      Dashboard.render('view-content'); break;
      case 'calendar':       Calendar.init('view-content'); break;
      case 'employees':      Employees.renderList('view-content', params && params.filterShift); break;
      case 'employee-form':  Employees.renderForm('view-content', params && params.emp, !!(params && params.emp)); break;
      case 'employee-view':  Employees.renderProfile('view-content', params && params.empId); break;
      case 'leaves':         Leaves.renderList('view-content'); break;
      case 'leave-form':     Leaves.renderForm('view-content'); break;
      case 'overtime':       Overtime.renderList('view-content'); break;
      case 'overtime-form':  Overtime.renderForm('view-content'); break;
      case 'transfers':      _renderTransfers('view-content'); break;
      case 'notifications':  Notifications.render('view-content'); break;
      case 'export':         Export.renderExportPanel('view-content'); break;
      case 'settings':       _renderSettings('view-content'); break;
      case 'profile':        Employees.renderProfile('view-content', null); break;
    }
  }

  // ============================================================
  // التنقلات
  // ============================================================

  function _renderTransfers(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    API.getTransfers().then(function(res) {
      if (!res.ok || !res.data.length) {
        el.innerHTML = '<div class="empty-state">لا توجد تنقلات مسجّلة</div>'; return;
      }
      el.innerHTML = '<div class="req-list">' +
        res.data.map(function(t) {
          var sk = CONFIG.shiftKey(t.newShift||'');
          var sc = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
          return '<div class="req-card" style="border-right:4px solid ' + sc.color + '">' +
            '<div class="req-card-header"><span class="req-no">' + t.empId + '</span><span>' + t.name + '</span></div>' +
            '<div class="req-card-body">' +
              '<div class="req-row"><span class="rr-label">من وردية</span><span>' + (t.oldShift||'—') + '</span></div>' +
              '<div class="req-row"><span class="rr-label">إلى وردية</span><span>' + (t.newShift||'—') + '</span></div>' +
              '<div class="req-row"><span class="rr-label">تاريخ النقل</span><span>' + CONFIG.fmtDate(t.transferDate) + '</span></div>' +
              (t.notes ? '<div class="req-row"><span class="rr-label">ملاحظات</span><span>' + t.notes + '</span></div>' : '') +
            '</div></div>';
        }).join('') +
      '</div>';
    });
  }

  // ============================================================
  // الإعدادات (مدير فقط)
  // ============================================================

  function _renderSettings(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    if (!Auth.isAdmin()) { el.innerHTML = '<div class="empty-state">غير مصرح</div>'; return; }

    API.getSettings().then(function(res) {
      if (!res.ok) { el.innerHTML = '<div class="empty-state">تعذّر التحميل</div>'; return; }
      var cfg = res.data;

      var html = '<div class="settings-container"><form id="settings-form" class="form-card">';
      html += '<div class="form-grid">';
      html += _settSection('إعدادات الشركة');
      html += _settField('اسم الشركة', 'company_name', cfg.company_name, 'text');
      html += _settSection('إعدادات دورة الورديات');
      html += _settField('تاريخ المرجع', 'ref_date', cfg.ref_date, 'date');
      html += _settField('موضع وردية أ', 'shift_a_pos', cfg.shift_a_pos, 'number');
      html += _settField('موضع وردية ب', 'shift_b_pos', cfg.shift_b_pos, 'number');
      html += _settField('موضع وردية ج', 'shift_c_pos', cfg.shift_c_pos, 'number');
      html += _settField('موضع وردية د', 'shift_d_pos', cfg.shift_d_pos, 'number');
      html += _settField('لون وردية أ', 'color_shift_a', cfg.color_shift_a, 'color');
      html += _settField('لون وردية ب', 'color_shift_b', cfg.color_shift_b, 'color');
      html += _settField('لون وردية ج', 'color_shift_c', cfg.color_shift_c, 'color');
      html += _settField('لون وردية د', 'color_shift_d', cfg.color_shift_d, 'color');
      html += _settSection('الإجازات');
      html += _settField('أيام الإجازة السنوية', 'annual_leave_days', cfg.annual_leave_days, 'number');
      html += _settSection('رموز الترقية');
      html += _settField('رمز المدير',        'admin_code',      '', 'password', 'اتركه فارغاً للإبقاء على الحالي');
      html += _settField('رمز مشرف الوردية', 'supervisor_code', '', 'password', 'اتركه فارغاً للإبقاء على الحالي');
      html += _settField('رمز التنسيق الإداري','viewer_code',   '', 'password', 'اتركه فارغاً للإبقاء على الحالي');
      html += _settSection('إعدادات API');
      html += _settField('الحد اليومي للطلبات', 'api_limit_daily', cfg.api_limit_daily, 'number');
      html += _settField('بريد التنبيهات',       'api_alert_email', cfg.api_alert_email, 'email');
      html += _settField('نسبة التحذير (%)',      'api_warn_pct',    cfg.api_warn_pct, 'number');
      html += _settField('نسبة الإنذار (%)',      'api_alert_pct',   cfg.api_alert_pct, 'number');
      html += '</div>'; // form-grid
      html += '<div class="form-actions">' +
        '<button type="submit" class="btn-primary">حفظ الإعدادات</button>' +
      '</div>';
      html += '</form>';

      // منطقة الخطر
      html += '<div class="danger-zone">' +
        '<h3>⚠️ إعادة تعيين الإجازات السنوية</h3>' +
        '<p>إضافة ' + (cfg.annual_leave_days||33) + ' يوم إلى رصيد كل موظف (يتم تلقائياً كل 1 يناير).</p>' +
        '<button class="btn-danger" id="btn-reset">إضافة الإجازات السنوية الآن</button>' +
      '</div>';

      html += '</div>'; // settings-container
      el.innerHTML = html;

      document.getElementById('settings-form').onsubmit = function(e) {
        e.preventDefault();
        var updates = {};
        this.querySelectorAll('.sett-input').forEach(function(inp) {
          if (inp.value.trim()) updates[inp.dataset.key] = inp.value.trim();
        });
        API.updateSettings(updates).then(function(res) {
          toast(res.ok ? 'تم حفظ الإعدادات' : 'حدث خطأ: ' + res.error, res.ok ? 'success' : 'error');
        });
      };

      document.getElementById('btn-reset').onclick = function() {
        if (!confirm('إضافة الإجازات السنوية لجميع الموظفين؟')) return;
        var btn = this; btn.disabled = true; btn.textContent = 'جارٍ...';
        API.yearlyLeaveReset().then(function(res) {
          btn.disabled = false; btn.textContent = 'إضافة الإجازات السنوية الآن';
          toast(res.ok ? 'تمت إضافة الإجازات' : 'حدث خطأ', res.ok ? 'success' : 'error');
        });
      };
    });
  }

  function _settSection(title) {
    return '<div class="form-section-title">' + title + '</div>';
  }

  function _settField(label, key, val, type, placeholder) {
    var inputHtml;
    if (type === 'password') {
      inputHtml = '<div class="pw-wrap"><input type="password" id="si-' + key + '" class="form-input sett-input" data-key="' + key + '"' +
        (placeholder ? ' placeholder="' + placeholder + '"' : '') + '>' +
        '<button type="button" class="pw-eye" onclick="App.togglePw(\'si-' + key + '\',this)">👁</button></div>';
    } else {
      inputHtml = '<input type="' + (type||'text') + '" id="si-' + key + '" class="form-input sett-input" data-key="' + key + '" value="' + (val||'') + '"' +
        (placeholder ? ' placeholder="' + placeholder + '"' : '') + '>';
    }
    return '<div class="form-field"><label>' + label + '</label>' + inputHtml + '</div>';
  }

  // ============================================================
  // إشعارات
  // ============================================================

  function loadNotifBadge() {
    Notifications.loadBadge('notif-dot');
  }

  // ============================================================
  // مساعدات عامة
  // ============================================================

  function toast(msg, type) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className   = 'toast toast-' + (type||'info') + ' show';
    clearTimeout(t._timer);
    t._timer = setTimeout(function() { t.classList.remove('show'); }, 3500);
  }

  function togglePw(inputId, eyeEl) {
    var inp = document.getElementById(inputId);
    if (!inp) return;
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    eyeEl.textContent = show ? '🙈' : '👁';
  }

  function _roleClass(role) {
    return { 'مدير':'admin','مشرف':'supervisor','موظف':'employee','اداري':'viewer' }[role] || 'employee';
  }

  return {
    init, navigate, goBack, toast, togglePw, loadNotifBadge
  };
})();

// ---- تشغيل التطبيق ----
document.addEventListener('DOMContentLoaded', function() { App.init(); });
