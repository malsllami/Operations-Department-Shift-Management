// ============================================================
// إدارة الموظفين — قائمة، بروفايل، نموذج
// ============================================================

var Employees = (function () {

  var _cache = {};

  // ============================================================
  // قائمة الموظفين
  // ============================================================

  function renderList(containerId, filterShift) {
    var el = document.getElementById(containerId);
    if (!el) return;
    _cache = {};
    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    Promise.all([API.getEmployees(), API.getRegions()]).then(function(results) {
      var empRes = results[0];
      var rgRes  = results[1];

      if (!empRes.ok || !empRes.data.length) {
        el.innerHTML = '<div class="empty-state">لا يوجد موظفون مسجلون</div>'; return;
      }

      var rgMap = {};
      if (rgRes.ok) rgRes.data.forEach(function(r) { rgMap[String(r.empId)] = r; });

      empRes.data.forEach(function(emp) { _cache[String(emp.empId)] = emp; });

      var html = _buildFilterBar(filterShift);
      html += '<div class="emp-grid" id="emp-grid">';
      empRes.data.forEach(function(emp) {
        html += _empCard(emp, rgMap[String(emp.empId)]);
      });
      html += '</div>';

      el.innerHTML = html;
      _bindFilters(empRes.data, rgMap);
      if (filterShift) _applyFilters(empRes.data, rgMap, '', filterShift);
    });
  }

  function _buildFilterBar(filterShift) {
    var html = '<div class="list-filters">' +
      '<input type="text" id="emp-search" class="search-input" placeholder="🔍 بحث بالاسم أو الرقم...">' +
      '<select id="emp-shift-filter" class="filter-select">' +
        '<option value="">كل الورديات</option>';
    ['a','b','c','d'].forEach(function(k) {
      var lbl = CONFIG.SHIFTS[k].label;
      html += '<option value="' + lbl + '"' + (lbl === filterShift ? ' selected' : '') + '>وردية ' + lbl + '</option>';
    });
    html += '</select>';
    if (Auth.isAdmin() || Auth.isSupervisor()) {
      html += '<button class="btn-add" onclick="App.navigate(\'employee-form\')">+ إضافة موظف</button>';
    }
    html += '</div>';
    return html;
  }

  function _empCard(emp, rg) {
    var sk   = CONFIG.shiftKey(emp.shift);
    var sc   = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
    var wc   = CONFIG.expiryClass(emp.workDaysLeft);
    var sc2  = CONFIG.expiryClass(emp.srcDaysLeft);
    var role = Auth.getEffectiveRole();

    return '<div class="emp-card hover-lift" data-name="' + (emp.name||'').toLowerCase() + '" data-id="' + (emp.empId||'') + '" data-shift="' + (emp.shift||'') + '">' +
      '<div class="emp-card-header" style="background:' + sc.color + '">' +
        '<div class="ech-row">' +
          '<span class="ech-shift">وردية ' + sc.label + '</span>' +
          '<span class="ech-role">' + (emp.role||'') + '</span>' +
        '</div>' +
        '<div class="ech-name">' + (emp.name||'') + '</div>' +
        '<div class="ech-id">' + (emp.empId||'') + '</div>' +
      '</div>' +
      '<div class="emp-card-body">' +
        _field('الجوال', (emp.phone ? '+966 ' + emp.phone : '—')) +
        _field('المنطقة', rg ? (rg.region||'—') : '—') +
        _field('المركز',  rg ? (rg.center ||'—') : '—') +
      '</div>' +
      '<div class="emp-card-expiry">' +
        (wc  ? _expiryBadge('بطاقة العمل', emp.workDaysLeft, wc) : '') +
        (sc2 ? _expiryBadge('بطاقة المصدر', emp.srcDaysLeft, sc2) : '') +
      '</div>' +
      '<div class="emp-card-footer">' +
        '<button class="btn-sm btn-view" onclick="Employees.viewProfile(\'' + emp.empId + '\')">عرض</button>' +
        ((role === 'مدير' || role === 'مشرف') ?
          '<button class="btn-sm btn-edit" onclick="Employees.editEmployee(\'' + emp.empId + '\')">تعديل</button>' : '') +
        (Auth.isAdmin() ?
          '<button class="btn-sm btn-transfer" onclick="Employees.transferDialog(\'' + emp.empId + '\',\'' + (emp.name||'') + '\')">نقل</button>' : '') +
        (Auth.isSupervisor() && emp.shift === Auth.getShift() ?
          '<button class="btn-sm btn-transfer" onclick="Employees.transferDialog(\'' + emp.empId + '\',\'' + (emp.name||'') + '\')">نقل</button>' : '') +
      '</div>' +
    '</div>';
  }

  function _field(label, val) {
    return '<div class="emp-field"><span class="ef-label">' + label + '</span><span class="ef-val">' + (val||'—') + '</span></div>';
  }

  function _expiryBadge(label, days, cls) {
    var txt = (days >= 0) ? days + ' يوم' : 'منتهية';
    return '<span class="expiry-badge" style="background:' + cls.bg + ';color:' + cls.text + '">' + label + ': ' + txt + '</span>';
  }

  function _bindFilters(data, rgMap) {
    var search = document.getElementById('emp-search');
    var filter = document.getElementById('emp-shift-filter');
    if (search) search.oninput = function() { _applyFilters(data, rgMap, this.value, filter ? filter.value : ''); };
    if (filter) filter.onchange = function() { _applyFilters(data, rgMap, search ? search.value : '', this.value); };
  }

  function _applyFilters(data, rgMap, q, shift) {
    q = (q||'').toLowerCase();
    var cards = document.querySelectorAll('.emp-card');
    var shown = 0;
    cards.forEach(function(card) {
      var name = card.dataset.name  || '';
      var id   = String(card.dataset.id || '').toLowerCase();
      var cs   = card.dataset.shift || '';
      var show = (!q || name.includes(q) || id.includes(q)) && (!shift || cs === shift);
      card.style.display = show ? '' : 'none';
      if (show) shown++;
    });
    var emptyEl = document.getElementById('emp-empty');
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.id = 'emp-empty'; emptyEl.className = 'empty-state';
      emptyEl.textContent = 'لا توجد نتائج مطابقة';
      var grid = document.getElementById('emp-grid');
      if (grid) grid.appendChild(emptyEl);
    }
    emptyEl.style.display = shown === 0 ? 'block' : 'none';
  }

  // ============================================================
  // بروفايل الموظف الشامل
  // ============================================================

  function viewProfile(empId) {
    App.navigate('employee-view', { empId: empId });
  }

  function renderProfile(containerId, empId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    var targetId = empId || (Auth.getUser() ? Auth.getUser().empId : null);

    Promise.all([
      API.getEmployee(targetId),
      API.getRegions(targetId),
      API.getEquipment(targetId),
      API.getLeaves(targetId)
    ]).then(function(results) {
      var emp = results[0].ok ? results[0].data : {};
      var rg  = results[1].ok && results[1].data.length ? results[1].data[0] : {};
      var eq  = results[2].ok && results[2].data.length ? results[2].data[0] : {};
      var lv  = results[3].ok && results[3].data.length ? results[3].data[0] : {};

      var sk  = CONFIG.shiftKey(emp.shift || '');
      var sc  = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
      var st  = CONFIG.getShiftStatus(emp.shift || '', CONFIG.todayStr());
      var stc = CONFIG.STATUS[st.en] || CONFIG.STATUS.off;

      var html = '<div class="profile-card">';

      // رأس البروفايل
      html += '<div class="profile-header" style="background:' + sc.color + '">' +
        '<div class="ph-avatar">' + ((emp.name||'?')[0]) + '</div>' +
        '<div class="ph-info">' +
          '<h2>' + (emp.name||'—') + '</h2>' +
          '<p class="ph-sub">' + (emp.empId||'') + ' — ' + (emp.role||'') + '</p>' +
          '<span class="ph-today-status" style="background:' + stc.bg + ';color:' + stc.text + '">' +
            stc.icon + ' ' + stc.label + ' اليوم' +
          '</span>' +
        '</div>' +
      '</div>';

      html += '<div class="profile-sections">';

      // البيانات الأساسية
      html += _section('البيانات الأساسية', [
        ['الوردية',    'وردية ' + (emp.shift||'—')],
        ['الجوال',     emp.phone ? '+966 ' + emp.phone : '—'],
        ['تاريخ التسجيل', CONFIG.fmtDate(emp.regDate)]
      ]);

      // المنطقة والمركز
      html += _section('المنطقة والمركز والسيارة', [
        ['المنطقة',    rg.region||'—'],
        ['المركز',     rg.center||'—'],
        ['رقم السيارة',rg.car||'—']
      ]);

      // بطاقات الانتهاء
      html += '<div class="profile-section"><h3 class="section-title">صلاحية البطاقات</h3><div class="expiry-grid">' +
        _expiryRow('بطاقة العمل',       emp.workExpDate, emp.workDaysLeft) +
        _expiryRow('بطاقة مصدر/مستلم', emp.srcExpDate,  emp.srcDaysLeft) +
      '</div></div>';

      // أرصدة الإجازات
      html += '<div class="profile-section"><h3 class="section-title">أرصدة الإجازات</h3><div class="leave-grid">' +
        _leaveBal('رصيد السنوية',    lv.annBal,   false) +
        _leaveBal('المتبقي السنوية', lv.annRem,   true)  +
        _leaveBal('رصيد المجدولة',   lv.schedBal, false) +
        _leaveBal('المتبقي المجدولة',lv.schedRem, false) +
        _leaveBal('مرضية',           lv.sick,     false) +
        _leaveBal('مولود',           lv.birth,    false) +
        _leaveBal('وفاة',            lv.death,    false) +
        _leaveBal('زواج',            lv.marriage, false) +
        _leaveBal('اختبارات',        lv.exam,     false) +
        _leaveBal('دورة عمل',        lv.workCourse,   false) +
        _leaveBal('خدمة عمل طويلة', lv.longService,  false) +
      '</div></div>';

      // المقاسات والعدد
      html += _section('العدد والمقاسات', [
        ['CAT 2 قميص',       eq.cat2Shirt||'—'],
        ['CAT 2 بنطلون',     eq.cat2Pants||'—'],
        ['سيفتي شوز',        eq.shoes||'—'],
        ['CAT 4 بدلة',       eq.cat4||'—'],
        ['برافو',             eq.bravo||'—'],
        ['ميجر',              eq.major||'—'],
        ['عدد أخرى',          eq.other||'—']
      ]);

      html += '</div>'; // profile-sections

      // أزرار التعديل
      var myId = Auth.getUser() ? String(Auth.getUser().empId) : '';
      var canEdit = Auth.canManage() || (myId === String(emp.empId));
      if (canEdit) {
        html += '<div class="profile-actions">' +
          '<button class="btn-primary" onclick="Employees.editEmployee(\'' + emp.empId + '\')">تعديل البيانات</button>' +
        '</div>';
      }

      html += '</div>'; // profile-card
      el.innerHTML = html;
    });
  }

  function _section(title, rows) {
    return '<div class="profile-section"><h3 class="section-title">' + title + '</h3>' +
      '<div class="profile-fields">' +
        rows.map(function(r) {
          return '<div class="pf-row"><span class="pf-label">' + r[0] + '</span><span class="pf-val">' + r[1] + '</span></div>';
        }).join('') +
      '</div></div>';
  }

  function _expiryRow(label, date, days) {
    var cls = CONFIG.expiryClass(days);
    var txt = (days !== null && days !== undefined && days !== '') ?
              (days >= 0 ? days + ' يوم' : 'منتهية') : '—';
    var bg  = cls ? cls.bg : '#F5F5F5';
    var clr = cls ? cls.text : '#757575';
    return '<div class="expiry-row" style="background:' + bg + ';color:' + clr + '">' +
      '<span>' + label + '</span>' +
      '<span>' + CONFIG.fmtDate(date) + '</span>' +
      '<span>' + txt + '</span>' +
    '</div>';
  }

  function _leaveBal(label, val, highlight) {
    return '<div class="leave-bal' + (highlight ? ' leave-total' : '') + '">' +
      '<span class="lb-val">' + (val !== undefined && val !== '' ? val : '—') + '</span>' +
      '<span class="lb-label">' + label + '</span>' +
    '</div>';
  }

  // ============================================================
  // نموذج الموظف (إضافة / تعديل)
  // ============================================================

  function editEmployee(empId) {
    var emp = _cache[String(empId)];
    if (emp) {
      App.navigate('employee-form', { emp: emp });
    } else {
      API.getEmployee(empId).then(function(r) {
        if (r.ok) App.navigate('employee-form', { emp: r.data });
      });
    }
  }

  function renderForm(containerId, emp, isEdit) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var user = Auth.getUser();
    var role = Auth.getEffectiveRole();
    var isEmployee = role === 'موظف';

    var html = '<form id="emp-form" class="form-card" novalidate>';
    html += '<div class="form-grid">';

    // الرقم الوظيفي — للقراءة فقط في التعديل
    if (isEdit) {
      html += _staticField('الرقم الوظيفي', emp.empId);
    } else {
      html += _inputField('empId', 'الرقم الوظيفي', emp ? emp.empId : '', 'text', true);
    }

    html += _inputField('name',  'الاسم كامل',   emp ? emp.name  : '', 'text', true);

    // حقل الجوال مع مفتاح الدولة
    html += _phoneField(emp ? emp.phone : '');

    if (!isEmployee) {
      // الوردية (مشرف: فقط ورديته، مدير: أي وردية)
      html += _shiftField(emp ? emp.shift : '', role);

      // الصلاحية مع رمز التحقق
      html += _roleField(emp ? emp.role : 'موظف');
    }

    // تواريخ انتهاء البطاقات
    html += _dateField('workExpDate', 'تاريخ انتهاء بطاقة العمل', emp ? emp.workExpDate : '');
    html += _dateField('srcExpDate',  'تاريخ انتهاء بطاقة مصدر/مستلم', emp ? emp.srcExpDate : '');

    html += '</div>'; // form-grid
    html += '<div id="form-error" class="form-error" style="display:none"></div>';
    html += '<div class="form-actions">' +
      '<button type="submit" class="btn-primary">' + (isEdit ? 'حفظ التعديلات' : 'إضافة الموظف') + '</button>' +
      '<button type="button" class="btn-outline" onclick="App.goBack()">إلغاء</button>' +
    '</div>';
    html += '</form>';

    el.innerHTML = html;
    _bindForm(isEdit, emp ? emp.empId : null);
  }

  function _phoneField(val) {
    var latin = val ? CONFIG.toLatinNums(String(val)).replace(/^0/, '') : '';
    return '<div class="form-field">' +
      '<label>رقم الجوال <span class="req">*</span></label>' +
      '<div class="phone-input-group">' +
        '<span class="phone-prefix">+966</span>' +
        '<input type="tel" id="f-phone" class="form-input phone-input" value="' + latin + '" ' +
          'placeholder="5XXXXXXXX" maxlength="9" required>' +
      '</div>' +
      '<small class="field-hint">يبدأ بـ 5 — 9 أرقام</small>' +
    '</div>';
  }

  function _shiftField(val, role) {
    var html = '<div class="form-field"><label>الوردية</label><select id="f-shift" class="form-select">';
    ['أ','ب','ج','د'].forEach(function(s) {
      var sk = CONFIG.shiftKey(s);
      var sc = CONFIG.SHIFTS[sk];
      if (role === 'مشرف' && s !== Auth.getShift()) return;
      html += '<option value="' + s + '"' + (val === s ? ' selected' : '') + '>وردية ' + sc.label + '</option>';
    });
    return html + '</select></div>';
  }

  function _roleField(val) {
    var html = '<div class="form-field"><label>الصلاحية</label><select id="f-role" class="form-select" onchange="Employees._roleChange(this)">';
    ['موظف','مشرف','اداري','مدير'].forEach(function(r) {
      html += '<option value="' + r + '"' + (val === r ? ' selected' : '') + '>' + r + '</option>';
    });
    html += '</select></div>';
    html += '<div id="role-code-wrap" class="form-field" style="display:' + (val && val !== 'موظف' ? 'block':'none') + '">' +
      '<label>رمز الترقية <span class="req">*</span></label>' +
      '<div class="pw-wrap">' +
        '<input type="password" id="f-role-code" class="form-input" placeholder="أدخل رمز الصلاحية">' +
        '<button type="button" class="pw-eye" onclick="App.togglePw(\'f-role-code\',this)">👁</button>' +
      '</div>' +
    '</div>';
    return html;
  }

  function _roleChange(select) {
    var wrap = document.getElementById('role-code-wrap');
    if (wrap) wrap.style.display = select.value !== 'موظف' ? 'block' : 'none';
  }

  function _bindForm(isEdit, empId) {
    var form = document.getElementById('emp-form');
    if (!form) return;
    form.onsubmit = function(e) {
      e.preventDefault();
      var errEl = document.getElementById('form-error');
      var btn   = form.querySelector('[type=submit]');
      errEl.style.display = 'none';

      var phone = CONFIG.toLatinNums(document.getElementById('f-phone').value.trim());
      if (!CONFIG.validatePhone(phone)) {
        errEl.textContent = 'رقم الجوال يجب أن يبدأ بـ 5 ويتكوّن من 9 أرقام';
        errEl.style.display = 'block'; return;
      }

      var data = {};
      var nameEl = document.getElementById('f-name');
      if (nameEl) data.name = nameEl.value.trim();
      data.phone = phone;

      var shiftEl = document.getElementById('f-shift');
      if (shiftEl) data.shift = shiftEl.value;

      var roleEl = document.getElementById('f-role');
      if (roleEl) data.role = roleEl.value;

      var rcEl = document.getElementById('f-role-code');
      if (rcEl) data.roleCode = rcEl.value;

      var weEl = document.getElementById('f-workExpDate');
      if (weEl) data.workExpDate = weEl.value;
      var seEl = document.getElementById('f-srcExpDate');
      if (seEl) data.srcExpDate = seEl.value;

      btn.disabled = true; btn.textContent = 'جارٍ الحفظ...';

      var prom;
      if (isEdit) {
        prom = API.updateEmployee(empId, data);
      } else {
        var idEl = document.getElementById('f-empId');
        data.empId = idEl ? idEl.value.trim() : '';
        prom = API.addEmployee(data);
      }

      prom.then(function(res) {
        btn.disabled = false; btn.textContent = isEdit ? 'حفظ التعديلات' : 'إضافة الموظف';
        if (res.ok) {
          App.toast(isEdit ? 'تم تعديل بيانات الموظف' : 'تمت إضافة الموظف', 'success');
          App.navigate('employees');
        } else {
          var errMap = {
            duplicate_id:    'الرقم الوظيفي موجود مسبقاً',
            duplicate_phone: 'رقم الجوال موجود مسبقاً',
            invalid_role_code: 'رمز الترقية غير صحيح',
            forbidden_shift: 'غير مصرح لك بإضافة موظف لهذه الوردية'
          };
          errEl.textContent = errMap[res.error] || ('حدث خطأ: ' + res.error);
          errEl.style.display = 'block';
        }
      });
    };
  }

  // ============================================================
  // نقل الموظف
  // ============================================================

  function transferDialog(empId, name) {
    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-box">' +
      '<h3>نقل ' + name + '</h3>' +
      '<div class="form-field"><label>الوردية الجديدة</label>' +
        '<select id="transfer-shift" class="form-select">' +
          ['أ','ب','ج','د'].map(function(s) {
            var sk = CONFIG.shiftKey(s);
            return '<option value="' + s + '">وردية ' + CONFIG.SHIFTS[sk].label + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<div class="form-field"><label>ملاحظات</label>' +
        '<input type="text" id="transfer-notes" class="form-input" placeholder="اختياري">' +
      '</div>' +
      '<div id="transfer-err" class="form-error" style="display:none"></div>' +
      '<div class="form-actions">' +
        '<button class="btn-primary" id="transfer-confirm-btn">تأكيد النقل</button>' +
        '<button class="btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">إلغاء</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(modal);

    modal.querySelector('#transfer-confirm-btn').onclick = function() {
      var newShift = modal.querySelector('#transfer-shift').value;
      var notes    = modal.querySelector('#transfer-notes').value;
      var errEl    = modal.querySelector('#transfer-err');
      var btn      = this;
      btn.disabled = true; btn.textContent = 'جارٍ النقل...';
      errEl.style.display = 'none';

      API.transferEmployee(empId, newShift, notes).then(function(res) {
        btn.disabled = false; btn.textContent = 'تأكيد النقل';
        if (res.ok) {
          modal.remove();
          App.toast('تم نقل الموظف بنجاح', 'success');
          App.navigate('employees');
        } else {
          var errMap = { same_shift:'الموظف في نفس الوردية', forbidden:'غير مصرح' };
          errEl.textContent = errMap[res.error] || ('حدث خطأ: ' + res.error);
          errEl.style.display = 'block';
        }
      });
    };
  }

  // ---- مساعدات ----
  function _staticField(label, val) {
    return '<div class="form-field"><label>' + label + '</label>' +
      '<div class="form-static">' + (val||'—') + '</div></div>';
  }

  function _inputField(id, label, val, type, req) {
    return '<div class="form-field"><label>' + label + (req ? ' <span class="req">*</span>' : '') + '</label>' +
      '<input type="' + (type||'text') + '" id="f-' + id + '" class="form-input" value="' + (val||'') + '"' + (req ? ' required' : '') + '>' +
    '</div>';
  }

  function _dateField(id, label, val) {
    return '<div class="form-field"><label>' + label + '</label>' +
      '<input type="date" id="f-' + id + '" class="form-input" value="' + (val||'') + '">' +
    '</div>';
  }

  return {
    renderList, renderProfile, viewProfile, editEmployee, renderForm,
    transferDialog, _roleChange,
    getCache: function() { return _cache; }
  };
})();
