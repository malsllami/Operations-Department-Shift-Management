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
    _initTheme();
    try {
      if (Auth.restore()) {
        _showApp();
        // استعادة آخر صفحة كانت مفتوحة قبل التحديث
        var lastView = sessionStorage.getItem('sm_last_view');
        navigate(lastView && lastView !== 'leave-form' && lastView !== 'overtime-form'
          && lastView !== 'employee-form' ? lastView : 'dashboard');
      } else {
        _showLogin();
      }
    } catch(e) {
      console.error('[App.init] خطأ في التهيئة:', e);
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
    // تحذير إذا لم يُضبط رابط GAS
    if (!CONFIG.API_URL || CONFIG.API_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
      setTimeout(function() {
        var container = document.getElementById('login-form-container');
        if (!container) return;
        var warn = document.createElement('div');
        warn.className = 'setup-warning';
        warn.innerHTML = '<strong>⚙️ إعداد مطلوب</strong><br>افتح <code>js/config.js</code> وضع رابط Google Apps Script في <code>API_URL</code>';
        container.insertBefore(warn, container.firstChild);
      }, 100);
    }
  }

  function _showApp() {
    document.getElementById('screen-login').style.display = 'none';
    document.getElementById('screen-app').style.display   = 'flex';
    _buildShell();
    // تحميل رسائل واتساب من جدول الإعدادات
    API.getWaMessages().then(function(res) {
      if (res.ok && res.data) {
        Object.keys(res.data).forEach(function(k) {
          if (res.data[k]) CONFIG.WA_MESSAGES[k] = res.data[k];
        });
      }
    });
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
        '<button type="button" class="btn-forgot-pw" onclick="App.showResetPassword()">نسيت كلمة المرور؟</button>' +
      '</form>';

    document.getElementById('login-form').onsubmit = function(e) {
      e.preventDefault();
      var empId = CONFIG.toLatinNums(document.getElementById('l-empid').value.trim());
      var pass  = document.getElementById('l-pass').value.trim();
      var errEl = document.getElementById('l-err');
      var btn   = document.getElementById('l-btn');

      if (!empId || !pass) { errEl.textContent = 'يرجى إدخال الرقم الوظيفي وكلمة المرور'; errEl.style.display = 'block'; return; }
      App.btnLoad(btn);
      errEl.style.display = 'none';

      Auth.login(empId, pass).then(function(res) {
        App.btnDone(btn, null, res.ok ? 'success' : 'error');
        if (res.ok) {
          if (res.force_change) {
            _renderChangePassForm();
          } else if (res.force_set_role_code) {
            _renderSetRoleCodeForm();
          } else {
            _showApp(); navigate('dashboard');
          }
        } else {
          var errs = {
            invalid_credentials: 'رقم وظيفي أو كلمة مرور غير صحيحة',
            network_error:       'خطأ في الاتصال — تحقق من الإنترنت',
            api_not_configured:  '⚙️ لم يتم ضبط رابط GAS بعد — افتح js/config.js وضع رابط Web App في API_URL'
          };
          errEl.textContent = errs[res.error] || 'حدث خطأ: ' + res.error;
          errEl.style.display = 'block';
        }
      });
    };
  }

  function _renderResetPasswordForm() {
    var el = document.getElementById('login-form-container');
    if (!el) return;

    el.innerHTML =
      '<div class="force-change-header">' +
        '<div class="fch-icon">🔑</div>' +
        '<h2>استعادة كلمة المرور</h2>' +
        '<p>أدخل رقمك الوظيفي واختر وردييتك للتحقق من هويتك</p>' +
      '</div>' +
      '<form id="reset-pw-form" novalidate>' +
        '<div class="login-field">' +
          '<label>الرقم الوظيفي</label>' +
          '<input type="text" id="rp-empid" class="login-input" placeholder="أدخل رقمك الوظيفي" autocomplete="username" required>' +
        '</div>' +
        '<div class="login-field">' +
          '<label>الوردية</label>' +
          '<select id="rp-shift" class="login-input" required>' +
            '<option value="">— اختر وردييتك —</option>' +
            '<option value="أ">وردية أ</option>' +
            '<option value="ب">وردية ب</option>' +
            '<option value="ج">وردية ج</option>' +
            '<option value="د">وردية د</option>' +
          '</select>' +
        '</div>' +
        '<div id="rp-err" class="login-error" style="display:none"></div>' +
        '<button type="submit" class="btn-login" id="rp-btn">تحقق واستعادة</button>' +
        '<button type="button" class="btn-forgot-pw" onclick="App.showLoginForm()">← رجوع لتسجيل الدخول</button>' +
      '</form>';

    document.getElementById('reset-pw-form').onsubmit = function(e) {
      e.preventDefault();
      var empId  = CONFIG.toLatinNums(document.getElementById('rp-empid').value.trim());
      var shift  = document.getElementById('rp-shift').value;
      var errEl  = document.getElementById('rp-err');
      var btn    = document.getElementById('rp-btn');

      errEl.style.display = 'none';
      if (!empId || !shift) {
        errEl.textContent = 'يرجى إدخال الرقم الوظيفي واختيار الوردية';
        errEl.style.display = 'block'; return;
      }

      App.btnLoad(btn);
      API.resetPassword(empId, shift).then(function(res) {
        App.btnDone(btn, null, res.ok ? 'success' : 'error');
        if (res.ok) {
          // تسجيل الدخول بكلمة المرور الافتراضية ثم إجبار التغيير
          Auth.login(empId, '123456').then(function(loginRes) {
            if (loginRes.ok) {
              _renderChangePassForm();
            } else {
              errEl.textContent = 'تمت الاستعادة — يرجى تسجيل الدخول بـ 123456';
              errEl.style.display = 'block';
            }
          });
        } else {
          errEl.textContent = 'الرقم الوظيفي أو الوردية غير صحيحة';
          errEl.style.display = 'block';
        }
      });
    };
  }

  function _renderChangePassForm() {
    var el = document.getElementById('login-form-container');
    if (!el) return;

    // إخفاء شعار تسجيل الدخول وإظهار شاشة التغيير كاملة
    var logoEl = document.querySelector('.login-logo');
    var subEl  = document.querySelector('.login-subtitle');
    if (logoEl) logoEl.style.display = 'none';
    if (subEl)  subEl.style.display  = 'none';

    el.innerHTML =
      '<div class="force-change-header">' +
        '<div class="fch-icon">🔐</div>' +
        '<h2>تغيير كلمة المرور إلزامي</h2>' +
        '<p>لأمان حسابك، يجب تغيير كلمة المرور الافتراضية قبل الدخول</p>' +
      '</div>' +
      '<form id="chpass-form" novalidate>' +
        '<div class="login-field"><label>كلمة المرور الجديدة</label>' +
          '<div class="pw-wrap">' +
            '<input type="password" id="cp-new" class="login-input" placeholder="6 أحرف على الأقل" required autocomplete="new-password">' +
            '<button type="button" class="pw-eye" onclick="App.togglePw(\'cp-new\',this)">' +
              '<svg viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="login-field"><label>تأكيد كلمة المرور الجديدة</label>' +
          '<div class="pw-wrap">' +
            '<input type="password" id="cp-confirm" class="login-input" placeholder="أعد كتابة كلمة المرور" required autocomplete="new-password">' +
            '<button type="button" class="pw-eye" onclick="App.togglePw(\'cp-confirm\',this)">' +
              '<svg viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="pass-rules">' +
          '<span id="rule-len"  class="pass-rule">✗ 6 أحرف على الأقل</span>' +
          '<span id="rule-diff" class="pass-rule">✗ مختلفة عن 123456</span>' +
          '<span id="rule-match"class="pass-rule">✗ متطابقتان</span>' +
        '</div>' +
        '<div id="cp-err" class="login-error" style="display:none"></div>' +
        '<button type="submit" class="btn-login" id="cp-btn" disabled>تغيير وحفظ</button>' +
      '</form>';

    // التحقق الفوري أثناء الكتابة
    var newEl = document.getElementById('cp-new');
    var conEl = document.getElementById('cp-confirm');
    var rLen  = document.getElementById('rule-len');
    var rDiff = document.getElementById('rule-diff');
    var rMtch = document.getElementById('rule-match');
    var btn   = document.getElementById('cp-btn');

    function _validate() {
      var np = newEl.value;
      var cp = conEl.value;
      var okLen  = np.length >= 6;
      var okDiff = np !== '123456';
      var okMtch = np.length > 0 && np === cp;
      rLen.className  = 'pass-rule ' + (okLen  ? 'pass-ok' : 'pass-fail');
      rLen.textContent  = (okLen  ? '✓' : '✗') + ' 6 أحرف على الأقل';
      rDiff.className = 'pass-rule ' + (okDiff ? 'pass-ok' : 'pass-fail');
      rDiff.textContent = (okDiff ? '✓' : '✗') + ' مختلفة عن 123456';
      rMtch.className = 'pass-rule ' + (okMtch ? 'pass-ok' : 'pass-fail');
      rMtch.textContent = (okMtch ? '✓' : '✗') + ' متطابقتان';
      btn.disabled = !(okLen && okDiff && okMtch);
    }
    newEl.addEventListener('input', _validate);
    conEl.addEventListener('input', _validate);

    document.getElementById('chpass-form').onsubmit = function(e) {
      e.preventDefault();
      var newPass = newEl.value;
      var confirm = conEl.value;
      var errEl   = document.getElementById('cp-err');

      if (newPass.length < 6)      { errEl.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'; errEl.style.display='block'; return; }
      if (newPass === '123456')     { errEl.textContent = 'لا يمكن استخدام كلمة المرور الافتراضية'; errEl.style.display='block'; return; }
      if (newPass !== confirm)      { errEl.textContent = 'كلمتا المرور غير متطابقتين'; errEl.style.display='block'; return; }

      App.btnLoad(btn);
      errEl.style.display = 'none';

      Auth.changePassword(newPass).then(function(res) {
        App.btnDone(btn, null, res.ok ? 'success' : 'error');
        if (res.ok) {
          App.toast('تم تغيير كلمة المرور بنجاح ✓', 'success');
          _showApp();
          navigate('dashboard');
        } else {
          var errs = {
            password_too_short:       'كلمة المرور قصيرة (6 أحرف كحد أدنى)',
            password_same_as_default: 'لا يمكن استخدام كلمة المرور الافتراضية'
          };
          errEl.textContent = errs[res.error] || 'حدث خطأ: ' + res.error;
          errEl.style.display = 'block';
        }
      });
    };
  }

  // ============================================================
  // شاشة تعيين رمز الصلاحية الشخصي (مشرف/مدير/اداري — إلزامي)
  // ============================================================

  function _renderSetRoleCodeForm() {
    var el = document.getElementById('login-form-container');
    if (!el) return;

    var user = Auth.getUser();
    var roleLabels = { 'مدير':'المدير', 'مشرف':'المشرف', 'اداري':'الإداري' };
    var label = roleLabels[user ? user.role : ''] || 'الصلاحية';

    var logoEl = document.querySelector('.login-logo');
    var subEl  = document.querySelector('.login-subtitle');
    if (logoEl) logoEl.style.display = 'none';
    if (subEl)  subEl.style.display  = 'none';

    el.innerHTML =
      '<div class="force-change-header">' +
        '<div class="fch-icon">🛡️</div>' +
        '<h2>تعيين رمز ' + label + '</h2>' +
        '<p>لأمان حسابك، يجب تعيين رمز صلاحية شخصي خاص بك قبل الدخول</p>' +
        '<p style="font-size:0.85rem;color:#9CA3AF">هذا الرمز مختلف عن كلمة مرور الدخول</p>' +
      '</div>' +
      '<form id="rc-form" novalidate>' +
        '<div class="login-field"><label>رمز الصلاحية الجديد</label>' +
          '<div class="pw-wrap">' +
            '<input type="password" id="rc-new" class="login-input" placeholder="6 أرقام على الأقل" required autocomplete="new-password">' +
            '<button type="button" class="pw-eye" onclick="App.togglePw(\'rc-new\',this)">👁</button>' +
          '</div>' +
        '</div>' +
        '<div class="login-field"><label>تأكيد رمز الصلاحية</label>' +
          '<div class="pw-wrap">' +
            '<input type="password" id="rc-confirm" class="login-input" placeholder="أعد الكتابة" required autocomplete="new-password">' +
            '<button type="button" class="pw-eye" onclick="App.togglePw(\'rc-confirm\',this)">👁</button>' +
          '</div>' +
        '</div>' +
        '<div class="pass-rules">' +
          '<span id="rc-r-len"  class="pass-rule">✗ 6 أرقام على الأقل</span>' +
          '<span id="rc-r-diff" class="pass-rule">✗ مختلف عن 123456</span>' +
          '<span id="rc-r-match"class="pass-rule">✗ متطابقان</span>' +
        '</div>' +
        '<div id="rc-err" class="login-error" style="display:none"></div>' +
        '<button type="submit" class="btn-login" id="rc-btn" disabled>تعيين وحفظ</button>' +
      '</form>';

    var newEl  = document.getElementById('rc-new');
    var conEl  = document.getElementById('rc-confirm');
    var rLen   = document.getElementById('rc-r-len');
    var rDiff  = document.getElementById('rc-r-diff');
    var rMatch = document.getElementById('rc-r-match');
    var btn    = document.getElementById('rc-btn');

    function _validate() {
      var np = newEl.value, cp = conEl.value;
      var okLen  = np.length >= 6;
      var okDiff = np !== '123456';
      var okMatch= np.length > 0 && np === cp;
      rLen.className   = 'pass-rule ' + (okLen   ? 'pass-ok' : 'pass-fail');
      rLen.textContent = (okLen  ? '✓' : '✗') + ' 6 أرقام على الأقل';
      rDiff.className  = 'pass-rule ' + (okDiff  ? 'pass-ok' : 'pass-fail');
      rDiff.textContent= (okDiff ? '✓' : '✗') + ' مختلف عن 123456';
      rMatch.className = 'pass-rule ' + (okMatch ? 'pass-ok' : 'pass-fail');
      rMatch.textContent=(okMatch? '✓' : '✗') + ' متطابقان';
      btn.disabled = !(okLen && okDiff && okMatch);
    }
    newEl.addEventListener('input', _validate);
    conEl.addEventListener('input', _validate);

    document.getElementById('rc-form').onsubmit = function(e) {
      e.preventDefault();
      var errEl = document.getElementById('rc-err');
      var code  = newEl.value;
      if (code.length < 6)   { errEl.textContent='الرمز يجب أن يكون 6 أرقام على الأقل'; errEl.style.display='block'; return; }
      if (code === '123456') { errEl.textContent='لا يمكن استخدام الرمز الافتراضي';       errEl.style.display='block'; return; }
      if (code !== conEl.value){ errEl.textContent='الرمزان غير متطابقان';                errEl.style.display='block'; return; }

      App.btnLoad(btn);
      errEl.style.display = 'none';

      Auth.setRoleCode(code).then(function(res) {
        App.btnDone(btn, null, res.ok ? 'success' : 'error');
        if (res.ok) {
          _showApp(); navigate('dashboard');
        } else {
          var errs = {
            code_too_short: 'الرمز قصير جداً',
            code_too_common:'لا يمكن استخدام الرمز الافتراضي',
            forbidden:      'غير مصرح لهذا الحساب'
          };
          errEl.textContent = errs[res.error] || 'حدث خطأ: ' + res.error;
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
      { id:'export',       icon:'📊', label:'التصدير',             show: role==='مدير'||role==='اداري'||role==='مشرف' },
      { id:'notifications',icon:'🔔', label:'الإشعارات',          show: true },
      { id:'profile',       icon:'👤', label:'ملفي الشخصي',          show: true },
      { id:'employee-card', icon:'🪪', label:'بطاقة الموظف الشاملة', show: true },
      { id:'regions-map',   icon:'🗺️', label:'المناطق والمراكز',     show: true },
      { id:'substations',   icon:'⚡', label:'خريطة المحطات',        show: true },
      { id:'settings',      icon:'⚙️', label:'الإعدادات',            show: role==='مدير' }
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
    var active    = Auth.isAdminMode();
    var baseRole  = Auth.getBaseRole();
    var roleLabels = { 'مدير':'المدير', 'مشرف':'المشرف', 'اداري':'الإداري' };
    var label = roleLabels[baseRole] || 'الإدارة';
    btn.innerHTML = active
      ? '<span>👤</span> وضع الموظف'
      : '<span>🛡️</span> لوحة ' + label;
    btn.title = active ? 'الانتقال لواجهة الموظف' : ('تفعيل لوحة ' + label);
  }

  function _toggleMode() {
    if (Auth.isAdminMode()) {
      // من مشرف/مدير/اداري → موظف: لا يحتاج رمز
      Auth.deactivateElevatedRole();
      _buildShell();
      navigate('dashboard');
      toast('تم التبديل لوضع الموظف ✓', 'info');
    } else {
      // من موظف → مشرف/مدير/اداري: يحتاج رمز شخصي
      _elevateModal();
    }
  }

  function _elevateModal() {
    var isActive   = Auth.isAdminMode();
    var baseRole   = Auth.getBaseRole();
    var roleLabels = { 'مدير':'المدير', 'مشرف':'المشرف', 'اداري':'الإداري' };
    var label    = roleLabels[baseRole] || 'الإدارة';
    var title    = isActive ? ('تأكيد الانتقال — ' + label) : ('تفعيل لوحة ' + label);
    var subtitle = 'أدخل رمز الصلاحية الخاص بـ' + label + ' للمتابعة';

    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML =
      '<div class="modal-box">' +
        '<div class="modal-icon">' + (isActive ? '👤' : '🛡️') + '</div>' +
        '<h3>' + title + '</h3>' +
        '<p style="color:var(--text-muted);margin-bottom:16px">' + subtitle + '</p>' +
        '<div class="pw-wrap"><input type="password" id="elev-code" class="form-input" placeholder="رمز الصلاحية" autocomplete="off">' +
          '<button type="button" class="pw-eye" onclick="App.togglePw(\'elev-code\',this)">👁</button>' +
        '</div>' +
        '<div id="elev-err" class="form-error" style="display:none"></div>' +
        '<div class="form-actions">' +
          '<button class="btn-primary" id="elev-ok">تأكيد</button>' +
          '<button class="btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">إلغاء</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.querySelector('#elev-code').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') modal.querySelector('#elev-ok').click();
    });
    setTimeout(function() { var el = modal.querySelector('#elev-code'); if (el) el.focus(); }, 50);

    modal.querySelector('#elev-ok').onclick = function() {
      var code  = modal.querySelector('#elev-code').value;
      var errEl = modal.querySelector('#elev-err');
      var btn   = this;
      if (!code) { errEl.textContent = 'يرجى إدخال الرمز'; errEl.style.display = 'block'; return; }
      btn.disabled = true; btn.textContent = 'جارٍ التحقق...';
      errEl.style.display = 'none';

      Auth.toggleElevatedRole(code).then(function(res) {
        btn.disabled = false; btn.textContent = 'تأكيد';
        if (res.ok) {
          modal.remove();
          _buildShell();
          navigate('dashboard');
          var msg = res.adminMode
            ? ('تم تفعيل لوحة ' + label + ' ✓')
            : 'تم التبديل لوضع الموظف ✓';
          toast(msg, 'success');
        } else {
          var errs = {
            invalid_code:     'الرمز غير صحيح — حاول مرة أخرى',
            no_elevated_role: 'لا توجد صلاحيات مرفوعة لهذا الحساب',
            session_expired:  'انتهت الجلسة — يرجى تسجيل الدخول مجددًا'
          };
          errEl.textContent = errs[res.error] || 'تعذّر التحقق';
          errEl.style.display = 'block';
          modal.querySelector('#elev-code').value = '';
          modal.querySelector('#elev-code').focus();
        }
      });
    };
  }

  // عرض رسالة انتهاء الجلسة مع زر تسجيل الدخول
  function showSessionExpired() {
    var existing = document.getElementById('session-expired-overlay');
    if (existing) return;
    var overlay = document.createElement('div');
    overlay.id = 'session-expired-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal-box" style="text-align:center">' +
        '<div style="font-size:3rem;margin-bottom:12px">⏱️</div>' +
        '<h3>انتهت الجلسة</h3>' +
        '<p style="color:var(--text-muted);margin:10px 0 20px">انتهت صلاحية جلستك — يرجى تسجيل الدخول مجددًا</p>' +
        '<button class="btn-primary" style="width:100%" onclick="document.getElementById(\'session-expired-overlay\').remove();App.reLogin()">تسجيل الدخول</button>' +
      '</div>';
    document.body.appendChild(overlay);
  }

  function reLogin() {
    Auth.logout();
    _showLogin();
  }

  // ============================================================
  // التوجيه
  // ============================================================

  function navigate(viewName, params) {
    if (_view) _history.push(_view);
    _view = viewName;
    _render(viewName, params);
    _updateActiveNav(viewName);
    // حفظ الصفحة الحالية للاستعادة عند التحديث
    try { sessionStorage.setItem('sm_last_view', viewName); } catch(e) {}
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
      employees:'الموظفون', 'employee-form':'بيانات الموظف', 'employee-view':'ملف الموظف', 'employee-card':'بطاقة الموظف الشاملة',
      leaves:'طلبات الإجازات', 'leave-form':'طلب إجازة',
      overtime:'العمل الإضافي', 'overtime-form':'طلب عمل إضافي',
      transfers:'التنقلات بين الورديات', notifications:'الإشعارات',
      export:'تصدير البيانات', settings:'الإعدادات', profile:'ملفي الشخصي',
      'regions-map':'المناطق والمراكز', 'substations':'خريطة المحطات', 'profile-pw':'تغيير كلمة المرور'
    };

    main.innerHTML = '<div class="view-header"><h1 class="view-title">' + (titles[viewName]||viewName) + '</h1></div>' +
                     '<div id="view-content" class="view-body"></div>';

    switch (viewName) {
      case 'dashboard':      Dashboard.render('view-content'); break;
      case 'calendar':       Calendar.init('view-content'); break;
      case 'employees':      Employees.renderList('view-content', params && params.filterShift); break;
      case 'employee-form':  Employees.renderForm('view-content', params || {}, !!(params && (params.emp || params.empId))); break;
      case 'employee-view':  Employees.renderProfile('view-content', params && params.empId); break;
      case 'employee-card':  Employees.renderFullCard('view-content', params && params.empId, !!(params && params.autoEdit)); break;
      case 'leaves':         Leaves.renderList('view-content'); break;
      case 'leave-form':     Leaves.renderForm('view-content'); break;
      case 'overtime':       Overtime.renderList('view-content'); break;
      case 'overtime-form':  Overtime.renderForm('view-content'); break;
      case 'regions-map':    _renderRegionsMap('view-content'); break;
      case 'substations':    Maps.render('view-content'); break;
      case 'transfers':      _renderTransfers('view-content'); break;
      case 'notifications':  Notifications.render('view-content'); break;
      case 'export':         Export.renderExportPanel('view-content'); break;
      case 'settings':       _renderSettings('view-content'); break;
      case 'profile-pw':     _renderProfilePwForm('view-content'); break;
      case 'profile':
        var _me = Auth.getUser();
        if (Auth.isAdminMode()) {
          // في وضع الإدارة: عرض البيانات الأساسية فقط بدون بطاقات الموظف
          Employees.renderAdminProfile('view-content', _me ? String(_me.empId) : '');
        } else {
          // في وضع الموظف: عرض الملف الكامل
          Employees.renderForm('view-content', { empId: _me ? String(_me.empId) : '' }, true);
        }
        break;
    }
  }

  // ============================================================
  // المناطق والمراكز — عرض شامل
  // ============================================================

  function _renderRegionsMap(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    var today = CONFIG.todayStr();

    Promise.all([
      API.getRegions(),
      API.getEmployees(),
      API.getLeaveReqs()
    ]).then(function(results) {
      var rgRes  = results[0];
      var empRes = results[1];
      var lvRes  = results[2];

      if (!rgRes.ok) { el.innerHTML = '<div class="empty-state">تعذّر تحميل البيانات</div>'; return; }

      // --- فهرسة الموظفين ---
      var empMap = {};
      if (empRes.ok) empRes.data.forEach(function(e) { empMap[String(e.empId)] = e; });

      // --- الموظفون في إجازة اليوم ---
      var onLeaveSet = {};
      if (lvRes.ok) {
        lvRes.data.forEach(function(lv) {
          if (lv.status === 'معتمد' && lv.startDate <= today && lv.endDate >= today) {
            onLeaveSet[String(lv.empId)] = true;
          }
        });
      }

      // --- بناء هيكل المناطق ---
      // { regionName: { centers: { centerName: [empRecord, ...] } } }
      var regMap = {};
      rgRes.data.forEach(function(rg) {
        var reg = rg.region || 'غير محددة';
        var cen = rg.center || 'غير محدد';
        if (!regMap[reg]) regMap[reg] = { centers: {} };
        if (!regMap[reg].centers[cen]) regMap[reg].centers[cen] = [];

        // استخدام بيانات جدول المناطق كـ fallback إذا لم تتوفر بيانات الموظفين
        var emp = empMap[String(rg.empId)] || { empId: rg.empId, name: rg.name, shift: rg.shift };
        if (!emp.name) return;

        var sk  = CONFIG.shiftKey(emp.shift || '');
        var sc  = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
        var st  = CONFIG.getShiftStatus(emp.shift || '', today);
        var stc = CONFIG.STATUS[st.en] || CONFIG.STATUS.off;
        regMap[reg].centers[cen].push({
          empId:   emp.empId,
          name:    emp.name,
          shift:   emp.shift,
          car:     rg.car || '—',
          sc:      sc,
          st:      st,
          stc:     stc,
          onLeave: !!onLeaveSet[String(emp.empId)]
        });
      });

      var regionNames  = Object.keys(regMap);
      var totalRegions = regionNames.length;
      var totalCenters = 0;
      regionNames.forEach(function(r) { totalCenters += Object.keys(regMap[r].centers).length; });

      // --- بطاقة الملخص ---
      var html = '<div class="rgm-summary">' +
        '<div class="rgm-stat"><span class="rgm-stat-num">' + totalRegions + '</span><span class="rgm-stat-lbl">منطقة</span></div>' +
        '<div class="rgm-stat-sep"></div>' +
        '<div class="rgm-stat"><span class="rgm-stat-num">' + totalCenters + '</span><span class="rgm-stat-lbl">مركز</span></div>' +
      '</div>';

      // --- بطاقات المناطق ---
      html += '<div class="rgm-regions">';
      regionNames.forEach(function(regName, ri) {
        var cenKeys   = Object.keys(regMap[regName].centers);
        var empCount  = 0;
        var lvCount   = 0;
        cenKeys.forEach(function(c) {
          regMap[regName].centers[c].forEach(function(e) {
            empCount++;
            if (e.onLeave) lvCount++;
          });
        });

        html += '<div class="rgm-region-card">' +
          '<div class="rgm-region-header" onclick="this.parentElement.classList.toggle(\'rgm-open\')">' +
            '<div class="rgm-region-title">' +
              '<span class="rgm-region-name">📍 ' + regName + '</span>' +
              '<span class="rgm-region-meta">' + cenKeys.length + ' مركز · ' + empCount + ' موظف' +
                (lvCount ? ' · <span class="rgm-leave-badge">' + lvCount + ' في إجازة</span>' : '') +
              '</span>' +
            '</div>' +
            '<span class="rgm-chevron">▾</span>' +
          '</div>' +

          '<div class="rgm-centers">';

        // --- مراكز المنطقة ---
        cenKeys.forEach(function(cenName) {
          var emps   = regMap[regName].centers[cenName];
          var cenLv  = emps.filter(function(e) { return e.onLeave; }).length;

          html += '<div class="rgm-center-block">' +
            '<div class="rgm-center-header" onclick="this.parentElement.classList.toggle(\'rgm-center-open\')">' +
              '<span class="rgm-center-name">🏢 ' + cenName + '</span>' +
              '<span class="rgm-center-meta">' + emps.length + ' موظف' +
                (cenLv ? ' · <span class="rgm-leave-badge">' + cenLv + ' في إجازة</span>' : '') +
              '</span>' +
              '<span class="rgm-chevron">▾</span>' +
            '</div>' +

            '<div class="rgm-emp-list">';

          // --- موظفو المركز ---
          emps.forEach(function(emp) {
            html += '<div class="rgm-emp-row" style="border-right: 4px solid ' + emp.sc.color + '; background: ' + emp.sc.bg + '20">' +
              '<div class="rgm-emp-info">' +
                '<span class="rgm-emp-name">' + emp.name + '</span>' +
                '<span class="rgm-emp-shift" style="background:' + emp.sc.color + ';color:#fff">' + emp.sc.label + '</span>' +
              '</div>' +
              '<div class="rgm-emp-badges">' +
                (emp.onLeave
                  ? '<span class="rgm-on-leave">🏖️ في إجازة</span>'
                  : '<span class="rgm-duty-badge" style="background:' + emp.stc.bg + ';color:' + emp.stc.text + '">' + emp.stc.icon + ' ' + emp.stc.label + '</span>') +
                (emp.car && emp.car !== '—' ? '<span class="rgm-car">🚗 ' + emp.car + '</span>' : '') +
              '</div>' +
            '</div>';
          });

          html += '</div></div>'; // rgm-emp-list + rgm-center-block
        });

        html += '</div></div>'; // rgm-centers + rgm-region-card
      });

      html += '</div>'; // rgm-regions
      el.innerHTML = html;
    });
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

  // ============================================================
  // تغيير كلمة المرور من داخل التطبيق (بعد تسجيل الدخول)
  // ============================================================
  function _renderProfilePwForm(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML =
      '<div style="max-width:440px;margin:0 auto">' +
        '<div class="form-card">' +
          '<div style="text-align:center;margin-bottom:20px">' +
            '<div style="font-size:2.4rem;margin-bottom:8px">🔐</div>' +
            '<p style="color:var(--text-muted);font-size:0.9rem">أدخل كلمة المرور الحالية ثم الجديدة</p>' +
          '</div>' +
          '<form id="profile-pw-form" novalidate>' +
            '<div class="form-grid">' +
              '<div class="form-field form-field-full">' +
                '<label>كلمة المرور الحالية <span class="req">*</span></label>' +
                '<div class="pw-wrap">' +
                  '<input type="password" id="ppw-current" class="form-input" placeholder="••••••" autocomplete="current-password" required>' +
                  '<button type="button" class="pw-eye" onclick="App.togglePw(\'ppw-current\',this)">👁</button>' +
                '</div>' +
              '</div>' +
              '<div class="form-field form-field-full">' +
                '<label>كلمة المرور الجديدة <span class="req">*</span></label>' +
                '<div class="pw-wrap">' +
                  '<input type="password" id="ppw-new" class="form-input" placeholder="6 أحرف على الأقل" autocomplete="new-password" required>' +
                  '<button type="button" class="pw-eye" onclick="App.togglePw(\'ppw-new\',this)">👁</button>' +
                '</div>' +
              '</div>' +
              '<div class="form-field form-field-full">' +
                '<label>تأكيد كلمة المرور الجديدة <span class="req">*</span></label>' +
                '<div class="pw-wrap">' +
                  '<input type="password" id="ppw-confirm" class="form-input" placeholder="أعد الكتابة" autocomplete="new-password" required>' +
                  '<button type="button" class="pw-eye" onclick="App.togglePw(\'ppw-confirm\',this)">👁</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div id="ppw-err" class="form-error" style="display:none"></div>' +
            '<div class="form-actions">' +
              '<button type="submit" class="btn-primary" id="ppw-btn">🔒 تغيير كلمة المرور</button>' +
              '<button type="button" class="btn-outline" onclick="App.goBack()">إلغاء</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';

    document.getElementById('profile-pw-form').onsubmit = function(e) {
      e.preventDefault();
      var cur     = document.getElementById('ppw-current').value.trim();
      var newPw   = document.getElementById('ppw-new').value.trim();
      var confirm = document.getElementById('ppw-confirm').value.trim();
      var errEl   = document.getElementById('ppw-err');
      var btn     = document.getElementById('ppw-btn');

      errEl.style.display = 'none';
      if (!cur)              { errEl.textContent = 'أدخل كلمة المرور الحالية';           errEl.style.display='block'; return; }
      if (newPw.length < 6)  { errEl.textContent = 'كلمة المرور الجديدة 6 أحرف على الأقل'; errEl.style.display='block'; return; }
      if (newPw === '123456') { errEl.textContent = 'لا يمكن استخدام كلمة المرور الافتراضية'; errEl.style.display='block'; return; }
      if (newPw !== confirm)  { errEl.textContent = 'كلمتا المرور الجديدة غير متطابقتين'; errEl.style.display='block'; return; }

      App.btnLoad(btn);
      Auth.changePassword(newPw, cur).then(function(res) {
        App.btnDone(btn, null, res.ok ? 'success' : 'error');
        if (res.ok) {
          toast('تم تغيير كلمة المرور بنجاح ✓', 'success');
          navigate('profile');
        } else {
          var errs = {
            wrong_password:           'كلمة المرور الحالية غير صحيحة',
            password_too_short:       'كلمة المرور قصيرة (6 أحرف كحد أدنى)',
            password_same_as_default: 'لا يمكن استخدام كلمة المرور الافتراضية',
            invalid_credentials:      'كلمة المرور الحالية غير صحيحة'
          };
          errEl.textContent = errs[res.error] || 'حدث خطأ: ' + res.error;
          errEl.style.display = 'block';
        }
      });
    };
  }

  // ============================================================
  // إعدادات — واجهة كاملة بثلاثة تبويبات
  // ============================================================
  function _renderSettings(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    if (!Auth.isAdmin()) { el.innerHTML = '<div class="empty-state">غير مصرح</div>'; return; }
    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    API.getSettings().then(function(res) {
      if (!res.ok) { el.innerHTML = '<div class="empty-state">تعذّر التحميل</div>'; return; }
      var cfg  = res.data;
      var rows = res.rows || Object.keys(cfg).map(function(k) { return { key:k, value:cfg[k], desc:'' }; });

      // --- تبويبات ---
      var html = '<div class="settings-container">' +
        '<div class="sett-tabs">' +
          '<button class="sett-tab sett-tab-active" onclick="App.switchSettTab(\'form\',this)">⚙️ الإعدادات الأساسية</button>' +
          '<button class="sett-tab" onclick="App.switchSettTab(\'table\',this)">📋 جدول الإعدادات الكامل</button>' +
          '<button class="sett-tab" onclick="App.switchSettTab(\'wa\',this)">💬 رسائل واتساب</button>' +
        '</div>';

      // ===== تبويب 1: النموذج الأساسي =====
      html += '<div id="sett-pane-form" class="sett-pane">';
      html += '<form id="settings-form" class="form-card"><div class="form-grid">';
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
      html += _settField('كلمة المرور الافتراضية', 'default_password', cfg.default_password, 'text');
      html += _settField('مدة الوردية (ساعة)', 'shift_hours', cfg.shift_hours, 'number');
      html += _settSection('رموز الترقية');
      html += _settField('رمز المدير',          'admin_code',      '', 'password', 'اتركه فارغاً للإبقاء على الحالي');
      html += _settField('رمز مشرف الوردية',   'supervisor_code', '', 'password', 'اتركه فارغاً للإبقاء على الحالي');
      html += _settField('رمز التنسيق الإداري', 'viewer_code',    '', 'password', 'اتركه فارغاً للإبقاء على الحالي');
      html += _settSection('إعدادات API');
      html += _settField('الحد اليومي للطلبات', 'api_limit_daily', cfg.api_limit_daily, 'number');
      html += _settField('بريد التنبيهات',       'api_alert_email', cfg.api_alert_email, 'email');
      html += _settField('نسبة التحذير (%)',      'api_warn_pct',    cfg.api_warn_pct,    'number');
      html += _settField('نسبة الإنذار (%)',      'api_alert_pct',   cfg.api_alert_pct,   'number');
      html += '</div>';
      html += '<div class="form-actions"><button type="submit" class="btn-primary">💾 حفظ الإعدادات</button></div>';
      html += '</form></div>';

      // ===== تبويب 2: الجدول الكامل =====
      var tableRows = rows.filter(function(r) { return r.key.indexOf('wa_') !== 0; });
      html += '<div id="sett-pane-table" class="sett-pane" style="display:none">';
      html += '<div class="form-card">';
      html += '<div class="sett-table-header">' +
        '<h3 class="section-title" style="margin:0">كل الإعدادات</h3>' +
        '<input type="text" class="form-input sett-search" placeholder="🔍 بحث عن مفتاح أو قيمة..." oninput="App.filterSettingsTable(this)">' +
      '</div>';
      html += '<div class="sett-table-wrap"><table class="sett-table" id="sett-main-table">' +
        '<thead><tr><th>المفتاح</th><th>القيمة</th><th>الوصف</th><th></th></tr></thead>' +
        '<tbody>';
      tableRows.forEach(function(r) { html += _settTableRow(r); });
      html += '</tbody></table></div>';

      // إضافة إعداد جديد
      html += '<div class="sett-add-block">' +
        '<h4 class="sett-add-title">➕ إضافة إعداد جديد</h4>' +
        '<div class="form-grid">' +
          '<div class="form-field"><label>المفتاح <span class="req">*</span></label>' +
            '<input type="text" id="new-sett-key" class="form-input" placeholder="my_key_here" dir="ltr"></div>' +
          '<div class="form-field"><label>القيمة</label>' +
            '<input type="text" id="new-sett-val" class="form-input" placeholder="القيمة"></div>' +
          '<div class="form-field"><label>الوصف (اختياري)</label>' +
            '<input type="text" id="new-sett-desc" class="form-input" placeholder="وصف مختصر"></div>' +
        '</div>' +
        '<div class="form-actions">' +
          '<button class="btn-add" onclick="App.addNewSetting()">➕ إضافة</button>' +
        '</div>' +
      '</div>';
      html += '</div></div>';

      // ===== تبويب 3: رسائل واتساب =====
      var waKeys = [
        { key:'wa_leave_new',     label:'إجازة — طلب جديد'          },
        { key:'wa_leave_approve', label:'إجازة — اعتماد'             },
        { key:'wa_leave_reject',  label:'إجازة — رفض'               },
        { key:'wa_ot_new',        label:'أوفرتايم — طلب جديد'       },
        { key:'wa_ot_approve',    label:'أوفرتايم — اعتماد'          },
        { key:'wa_ot_reject',     label:'أوفرتايم — رفض'            },
        { key:'wa_ot_system',     label:'أوفرتايم — إرسال للنظام'   },
        { key:'wa_ot_return',     label:'أوفرتايم — إعادة للمشرف'   }
      ];
      html += '<div id="sett-pane-wa" class="sett-pane" style="display:none">';
      html += '<form id="wa-form" class="form-card">';
      html += '<p class="field-hint" style="margin-bottom:14px">يمكن استخدام {no} كرمز لرقم الطلب في الرسالة</p>';
      html += '<div class="form-grid">';
      waKeys.forEach(function(wk) {
        var val = cfg[wk.key] || '';
        html += '<div class="form-field form-field-full"><label>' + wk.label + '</label>' +
          '<textarea id="wa-' + wk.key + '" class="form-textarea wa-input" data-key="' + wk.key + '" rows="3">' +
          val.replace(/</g,'&lt;') + '</textarea></div>';
      });
      html += '</div>';
      html += '<div class="form-actions"><button type="submit" class="btn-primary">💾 حفظ رسائل واتساب</button></div>';
      html += '</form></div>';

      // ===== منطقة الخطر =====
      html += '<div class="danger-zone">' +
        '<h3>⚠️ إعادة تعيين الإجازات السنوية</h3>' +
        '<p>إضافة ' + (cfg.annual_leave_days||33) + ' يوم إلى رصيد كل موظف (يتم تلقائياً كل 1 يناير).</p>' +
        '<button class="btn-danger" id="btn-reset">إضافة الإجازات السنوية الآن</button>' +
      '</div>';

      html += '</div>';
      el.innerHTML = html;

      // --- تسجيل Events ---
      document.getElementById('settings-form').onsubmit = function(e) {
        e.preventDefault();
        var updates = {};
        this.querySelectorAll('.sett-input').forEach(function(inp) {
          if (inp.value.trim()) updates[inp.dataset.key] = inp.value.trim();
        });
        var btn = this.querySelector('button[type="submit"]');
        App.btnLoad(btn);
        API.updateSettings(updates).then(function(r) {
          App.btnDone(btn, null, r.ok ? 'success' : 'error');
          toast(r.ok ? 'تم حفظ الإعدادات' : 'حدث خطأ: ' + r.error, r.ok ? 'success' : 'error');
        });
      };

      document.getElementById('wa-form').onsubmit = function(e) {
        e.preventDefault();
        var updates = {};
        this.querySelectorAll('.wa-input').forEach(function(ta) {
          updates[ta.dataset.key] = ta.value;
        });
        var btn = this.querySelector('button[type="submit"]');
        App.btnLoad(btn);
        API.updateSettings(updates).then(function(r) {
          App.btnDone(btn, null, r.ok ? 'success' : 'error');
          toast(r.ok ? 'تم حفظ رسائل واتساب' : 'حدث خطأ', r.ok ? 'success' : 'error');
        });
      };

      document.getElementById('btn-reset').onclick = function() {
        if (!confirm('إضافة الإجازات السنوية لجميع الموظفين؟')) return;
        var btn = this; btn.disabled = true; btn.textContent = 'جارٍ...';
        API.yearlyLeaveReset().then(function(r) {
          btn.disabled = false; btn.textContent = 'إضافة الإجازات السنوية الآن';
          toast(r.ok ? 'تمت إضافة الإجازات' : 'حدث خطأ', r.ok ? 'success' : 'error');
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
      inputHtml = '<input type="' + (type||'text') + '" id="si-' + key + '" class="form-input sett-input" data-key="' + key + '" value="' + (String(val||'').replace(/"/g,'&quot;')) + '"' +
        (placeholder ? ' placeholder="' + placeholder + '"' : '') + '>';
    }
    return '<div class="form-field"><label>' + label + '</label>' + inputHtml + '</div>';
  }

  // بناء صف في جدول الإعدادات
  function _settTableRow(r) {
    var key  = r.key;
    var val  = String(r.value || '');
    var desc = String(r.desc  || '');
    var disp = val.length > 60 ? val.slice(0,60) + '…' : (val || '—');
    var esc  = val.replace(/"/g,'&quot;').replace(/</g,'&lt;');
    return '<tr id="sr-' + key + '" data-key="' + key + '">' +
      '<td class="sett-key-cell"><code class="sett-key-code">' + key + '</code></td>' +
      '<td class="sett-val-cell">' +
        '<span class="sett-val-disp" id="svd-' + key + '">' + disp + '</span>' +
        '<div class="sett-inline-edit" id="sie-' + key + '" style="display:none">' +
          '<input type="text" class="form-input" id="sev-' + key + '" value="' + esc + '">' +
          '<div class="sett-inline-btns">' +
            '<button class="btn-primary" style="padding:5px 14px;font-size:0.82rem" onclick="App.saveSettingInline(\'' + key + '\')">حفظ</button>' +
            '<button class="btn-outline"  style="padding:5px 12px;font-size:0.82rem" onclick="App.cancelSettingEdit(\'' + key + '\')">إلغاء</button>' +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td class="sett-desc-cell">' + (desc||'—') + '</td>' +
      '<td class="sett-act-cell">' +
        '<button class="btn-edit" onclick="App.editSettingRow(\'' + key + '\')" title="تعديل">✏️</button>' +
      '</td>' +
    '</tr>';
  }

  // ---- وظائف جدول الإعدادات ----
  function switchSettTab(tabId, btn) {
    document.querySelectorAll('.sett-pane').forEach(function(p) { p.style.display = 'none'; });
    document.querySelectorAll('.sett-tab').forEach(function(t) { t.classList.remove('sett-tab-active'); });
    var pane = document.getElementById('sett-pane-' + tabId);
    if (pane) pane.style.display = '';
    if (btn) btn.classList.add('sett-tab-active');
  }

  function editSettingRow(key) {
    var disp = document.getElementById('svd-' + key);
    var edit = document.getElementById('sie-' + key);
    if (!disp || !edit) return;
    disp.style.display = 'none';
    edit.style.display = '';
    var inp = document.getElementById('sev-' + key);
    if (inp) inp.focus();
  }

  function cancelSettingEdit(key) {
    var disp = document.getElementById('svd-' + key);
    var edit = document.getElementById('sie-' + key);
    if (disp) disp.style.display = '';
    if (edit) edit.style.display = 'none';
  }

  function saveSettingInline(key) {
    var inp = document.getElementById('sev-' + key);
    if (!inp) return;
    var val = inp.value;
    var updates = {}; updates[key] = val;
    API.updateSettings(updates).then(function(r) {
      if (r.ok) {
        var disp = document.getElementById('svd-' + key);
        if (disp) disp.textContent = val.length > 60 ? val.slice(0,60) + '…' : (val||'—');
        cancelSettingEdit(key);
        toast('تم حفظ الإعداد', 'success');
      } else {
        toast('حدث خطأ: ' + r.error, 'error');
      }
    });
  }

  function addNewSetting() {
    var keyEl  = document.getElementById('new-sett-key');
    var valEl  = document.getElementById('new-sett-val');
    var descEl = document.getElementById('new-sett-desc');
    var key    = (keyEl  ? keyEl.value.trim()  : '');
    var val    = (valEl  ? valEl.value.trim()  : '');
    var desc   = (descEl ? descEl.value.trim() : '');
    if (!key) { toast('المفتاح مطلوب', 'error'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(key)) { toast('المفتاح: حروف إنجليزية وأرقام وـ فقط', 'error'); return; }
    var updates = {}; updates[key] = val;
    var descs   = {};  descs[key]  = desc;
    API.updateSettings(updates, descs).then(function(r) {
      if (r.ok) {
        var tbody = document.querySelector('#sett-main-table tbody');
        if (tbody) tbody.insertAdjacentHTML('beforeend', _settTableRow({ key:key, value:val, desc:desc }));
        if (keyEl)  keyEl.value  = '';
        if (valEl)  valEl.value  = '';
        if (descEl) descEl.value = '';
        toast('تمت الإضافة', 'success');
      } else {
        toast('حدث خطأ: ' + r.error, 'error');
      }
    });
  }

  function filterSettingsTable(inp) {
    var q = inp.value.trim().toLowerCase();
    var trs = document.querySelectorAll('#sett-main-table tbody tr');
    trs.forEach(function(tr) {
      tr.style.display = (!q || tr.textContent.toLowerCase().indexOf(q) >= 0) ? '' : 'none';
    });
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
    eyeEl.innerHTML = show
      ? '<svg viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
      : '<svg viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }

  // ---- أنيميشن زر التحميل — تحول دائري مع تغيير لون النتيجة ----
  function btnLoad(btn) {
    if (!btn) return;
    btn._origHtml  = btn.innerHTML;
    btn._origStyle = btn.style.cssText;
    var sz = Math.max(btn.offsetHeight || 44, 36);
    btn.style.cssText = 'width:' + sz + 'px!important;height:' + sz + 'px!important;min-width:0!important;max-width:' + sz + 'px!important;padding:0!important;border-radius:50%!important;flex:none!important;align-self:center!important;';
    btn.innerHTML = '';
    btn.classList.add('btn-loading');
    btn.disabled = true;
  }

  function btnDone(btn, text, status) {
    if (!btn) return;
    btn.classList.remove('btn-loading');
    btn.disabled = false;

    function _restore() {
      btn.style.cssText = btn._origStyle || '';
      btn.innerHTML = btn._origHtml || text || 'حفظ';
    }

    if (status === 'success' || status === 'error') {
      var cls = status === 'success' ? 'btn-success' : 'btn-error';
      btn.classList.add(cls);
      btn.innerHTML = status === 'success' ? '✓' : '✕';
      setTimeout(function() {
        btn.classList.remove(cls);
        _restore();
      }, 1800);
    } else {
      _restore();
    }
  }

  // ---- تبديل الوضع الداكن / الفاتح ----
  function toggleTheme() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('se-theme', next);
    var icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = next === 'dark' ? '☀️' : '🌙';
  }

  function _initTheme() {
    try {
      var saved = localStorage.getItem('se-theme') || 'light';
      document.documentElement.setAttribute('data-theme', saved);
      var icon = document.getElementById('theme-icon');
      if (icon) icon.textContent = saved === 'dark' ? '☀️' : '🌙';
    } catch(e) {}
  }

  function _roleClass(role) {
    return { 'مدير':'admin','مشرف':'supervisor','موظف':'employee','اداري':'viewer' }[role] || 'employee';
  }

  // ---- واتساب — رابط مباشر (يزيل + للتوافق مع wa.me) ----
  function _waLink(phone, msg) {
    var p = String(phone || '').replace(/\D/g, '');
    if (p.length === 9 && p[0] === '5') p = '966' + p;
    if (!p) return '#';
    return 'https://wa.me/' + p + (msg ? '?text=' + encodeURIComponent(msg) : '');
  }

  function showWaModal(contacts, msg, title) {
    var old = document.getElementById('_wa_modal');
    if (old) old.remove();
    if (!contacts || !contacts.length) {
      toast('لا توجد أرقام جوال مسجلة للمشرفين', 'error'); return;
    }
    var m = document.createElement('div');
    m.id = '_wa_modal';
    m.className = 'modal-overlay';
    m.innerHTML =
      '<div class="modal-box" style="max-width:420px">' +
        '<h3 style="margin-bottom:14px;color:var(--primary)">' + (title || 'إرسال واتساب') + '</h3>' +
        contacts.map(function(c) {
          var link = _waLink(c.phone, msg);
          if (link === '#') return '';
          return '<div class="wa-contact-row">' +
            '<div><span class="wa-name">' + c.name + '</span>' +
            '<span class="wa-role"> (' + c.role + ')</span></div>' +
            '<a href="' + link + '" target="_blank" class="btn-sm btn-wa">📱 فتح واتساب</a>' +
          '</div>';
        }).join('') +
        '<div class="form-actions" style="margin-top:14px">' +
          '<button class="btn-outline" onclick="document.getElementById(\'_wa_modal\').remove()">إغلاق</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
  }

  function showResetPassword() { _renderResetPasswordForm(); }
  function showLoginForm()     { _renderLoginForm(); }

  return {
    init, navigate, goBack, toast, togglePw, loadNotifBadge,
    btnLoad, btnDone, showSessionExpired, reLogin,
    toggleTheme, showResetPassword, showLoginForm,
    waLink: _waLink, showWaModal: showWaModal,
    // إعدادات — جدول كامل
    switchSettTab, editSettingRow, cancelSettingEdit,
    saveSettingInline, addNewSetting, filterSettingsTable
  };
})();

// ---- تشغيل التطبيق ----
document.addEventListener('DOMContentLoaded', function() { App.init(); });

// ---- قائمة الجوال ----
(function() {
  function _openMenu() {
    var sidebar  = document.getElementById('sidebar');
    var overlay  = document.getElementById('sidebar-overlay');
    var menuBtn  = document.getElementById('menu-toggle');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('show');
    if (menuBtn) menuBtn.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function _closeMenu() {
    var sidebar  = document.getElementById('sidebar');
    var overlay  = document.getElementById('sidebar-overlay');
    var menuBtn  = document.getElementById('menu-toggle');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
    if (menuBtn) menuBtn.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  document.addEventListener('click', function(e) {
    var btn = document.getElementById('menu-toggle');
    if (btn && (btn === e.target || btn.contains(e.target))) {
      var isOpen = document.getElementById('sidebar').classList.contains('open');
      if (isOpen) _closeMenu(); else _openMenu();
      return;
    }

    // إغلاق عند الضغط على الـ overlay
    var overlay = document.getElementById('sidebar-overlay');
    if (overlay && e.target === overlay) { _closeMenu(); return; }

    // إغلاق عند الضغط على عنصر نافيجيشن داخل السايدبار
    if (e.target.closest && e.target.closest('.nav-item')) {
      if (window.innerWidth <= 768) _closeMenu();
    }
  });
})();

// ---- تحويل الأرقام العربية/الفارسية تلقائياً في جميع حقول الإدخال ----
document.addEventListener('input', function(e) {
  var el = e.target;
  if (!el || !el.tagName) return;
  var tag = el.tagName.toLowerCase();
  if (tag !== 'input' && tag !== 'textarea') return;
  var t = (el.type || '').toLowerCase();
  if (t === 'password' || t === 'date' || t === 'time' || t === 'color') return;

  var val = el.value;
  // تحقق إذا يوجد أرقام عربية أو فارسية
  if (!/[٠-٩۰-۹]/.test(val)) return;

  var converted = CONFIG.toLatinNums(val);
  if (converted !== val) {
    var pos = el.selectionStart;
    el.value = converted;
    try { el.setSelectionRange(pos, pos); } catch(err) {}
  }
});
