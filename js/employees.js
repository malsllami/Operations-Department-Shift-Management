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
    App.navigate('employee-form', { empId: String(empId), emp: _cache[String(empId)] || null });
  }

  // ============================================================
  // نموذج الموظف الشامل — تبويبات
  // ============================================================

  function renderForm(containerId, params, isEdit) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var empId  = params ? (params.empId || (params.emp && params.emp.empId) || '') : '';
    var empInit= params ? params.emp : null;
    var user   = Auth.getUser();
    var role   = Auth.getEffectiveRole();

    // للموظف: دائماً تعديل نفسه
    if (role === 'موظف' && !empId) empId = user ? String(user.empId) : '';

    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    // جلب كامل بيانات الموظف من كل الجداول
    var targetId = empId || (user ? user.empId : '');
    Promise.all([
      API.getEmployee(targetId),
      API.getRegions(targetId),
      API.getEquipment(targetId),
      API.getLeaves(targetId)
    ]).then(function(results) {
      var emp = results[0].ok ? results[0].data : (empInit || {});
      var rg  = results[1].ok && results[1].data.length ? results[1].data[0] : {};
      var eq  = results[2].ok && results[2].data.length ? results[2].data[0] : {};
      var lv  = results[3].ok && results[3].data.length ? results[3].data[0] : {};

      _cache[String(emp.empId || targetId)] = emp;

      var tabs = [
        { id:'tab-basic',    label:'البيانات الأساسية', icon:'👤' },
        { id:'tab-region',   label:'المنطقة والمركز',   icon:'📍' },
        { id:'tab-equip',    label:'العدد والمقاسات',   icon:'🦺' },
        { id:'tab-leave',    label:'أرصدة الإجازات',    icon:'📅' }
      ];

      // للإضافة الجديدة (غير تعديل) عرّض تبويب واحد فقط
      if (!isEdit) tabs = [tabs[0]];

      var html = '<div class="tabs-container">';

      // رأس التبويبات
      html += '<div class="tabs-header">';
      tabs.forEach(function(t, i) {
        html += '<button class="tab-btn' + (i===0?' tab-active':'') + '" data-tab="' + t.id + '">' +
          t.icon + ' ' + t.label + '</button>';
      });
      html += '</div>';

      // محتوى التبويبات
      html += '<div class="tabs-body">';

      // ---- تبويب 1: البيانات الأساسية ----
      html += '<div class="tab-panel active" id="tab-basic">';
      html += '<form id="form-basic" class="form-grid" novalidate>';

      if (isEdit) {
        html += _staticField('الرقم الوظيفي', emp.empId || targetId);
      } else {
        html += _inputField('empId', 'الرقم الوظيفي', '', 'text', true);
      }

      html += _inputField('name', 'الاسم كامل', emp.name||'', 'text', true);
      html += _phoneField(emp.phone||'');

      if (role !== 'موظف') {
        html += _shiftField(emp.shift||'', role);
        html += _roleField(emp.role||'موظف');
      }

      html += _dateField('workExpDate', 'تاريخ انتهاء بطاقة العمل',         emp.workExpDate||'');
      html += _dateField('srcExpDate',  'تاريخ انتهاء بطاقة مصدر / مستلم', emp.srcExpDate||'');

      html += '<div class="form-actions form-field-full">' +
        '<button type="submit" class="btn-primary">💾 ' + (isEdit ? 'حفظ البيانات الأساسية' : 'إضافة الموظف') + '</button>' +
        '<button type="button" class="btn-outline" onclick="App.goBack()">إلغاء</button>' +
      '</div>';
      html += '<div id="err-basic" class="form-error" style="display:none"></div>';
      html += '</form></div>';

      if (isEdit) {
        // ---- تبويب 2: المنطقة والمركز ----
        html += '<div class="tab-panel" id="tab-region">';
        html += '<form id="form-region" class="form-grid" novalidate>';
        var regions = [
          { val:'شمال', label:'شمال' }, { val:'جنوب', label:'جنوب' },
          { val:'شرق',  label:'شرق'  }, { val:'غرب',  label:'غرب'  },
          { val:'وسط',  label:'وسط'  }
        ];
        html += '<div class="form-field"><label>المنطقة</label><select id="rg-region" class="form-select">' +
          '<option value="">اختر المنطقة...</option>' +
          regions.map(function(r) {
            return '<option value="' + r.val + '"' + (rg.region===r.val?' selected':'') + '>' + r.label + '</option>';
          }).join('') +
        '</select></div>';
        html += _inputField2('rg-center', 'اسم المركز',  rg.center||'', 'text');
        html += _inputField2('rg-car',    'رقم السيارة', rg.car||'',    'text');
        html += '<div class="form-actions form-field-full">' +
          '<button type="submit" class="btn-primary">💾 حفظ المنطقة والمركز</button>' +
        '</div>';
        html += '<div id="err-region" class="form-error" style="display:none"></div>';
        html += '</form></div>';

        // ---- تبويب 3: العدد والمقاسات ----
        html += '<div class="tab-panel" id="tab-equip">';
        html += '<form id="form-equip" class="form-grid" novalidate>';
        var eqFields = [
          { id:'eq-cat2shirt', label:'CAT 2 قميص',    val: eq.cat2Shirt||'' },
          { id:'eq-cat2pants', label:'CAT 2 بنطلون',  val: eq.cat2Pants||'' },
          { id:'eq-shoes',     label:'سيفتي شوز',     val: eq.shoes||''     },
          { id:'eq-cat4',      label:'CAT 4 بدلة',    val: eq.cat4||''      },
          { id:'eq-bravo',     label:'برافو',          val: eq.bravo||''     },
          { id:'eq-major',     label:'ميجر',           val: eq.major||''     },
          { id:'eq-other',     label:'عدد أخرى',      val: eq.other||''     }
        ];
        eqFields.forEach(function(f) {
          html += _inputField2(f.id, f.label, f.val, 'text');
        });
        html += '<div class="form-actions form-field-full">' +
          '<button type="submit" class="btn-primary">💾 حفظ العدد والمقاسات</button>' +
        '</div>';
        html += '<div id="err-equip" class="form-error" style="display:none"></div>';
        html += '</form></div>';

        // ---- تبويب 4: أرصدة الإجازات ----
        html += '<div class="tab-panel" id="tab-leave">';
        html += '<form id="form-leave" class="form-grid" novalidate>';

        var canEditLeave = role !== 'موظف' || !lv.annBal;
        var lvHint = role === 'موظف' && lv.annBal
          ? '<div class="form-warning" style="margin-bottom:12px">⚠️ يمكن إدخال الرصيد مرة واحدة فقط — للتعديل تواصل مع المشرف</div>'
          : '';
        html += '<div class="form-field-full">' + lvHint + '</div>';

        var lvFields = [
          { id:'lv-ann',    label:'رصيد في النظام (السنوي)',     val:lv.annBal||'',       disabled: role==='موظف' && !!lv.annBal },
          { id:'lv-sched',  label:'رصيد الإجازات المجدولة',     val:lv.schedBal||'',     disabled: role==='موظف' },
          { id:'lv-sick',   label:'مرضية',                       val:lv.sick||'',          disabled: false },
          { id:'lv-birth',  label:'مولود',                       val:lv.birth||'',         disabled: false },
          { id:'lv-death',  label:'وفاة',                        val:lv.death||'',         disabled: false },
          { id:'lv-marr',   label:'زواج',                        val:lv.marriage||'',      disabled: false },
          { id:'lv-exam',   label:'اختبارات',                    val:lv.exam||'',          disabled: false },
          { id:'lv-course', label:'دورة عمل',                    val:lv.workCourse||'',    disabled: false },
          { id:'lv-long',   label:'خدمة عمل طويلة',             val:lv.longService||'',   disabled: false }
        ];
        lvFields.forEach(function(f) {
          html += '<div class="form-field">' +
            '<label>' + f.label + '</label>' +
            '<input type="number" id="' + f.id + '" class="form-input" value="' + f.val + '" min="0"' +
            (f.disabled ? ' disabled' : '') + '>' +
          '</div>';
        });
        var firstTime = !lv.annBal;
        html += '<div class="form-actions form-field-full">' +
          '<button type="submit" class="btn-primary"' + (role==='موظف' && !firstTime ? ' disabled' : '') + '>💾 ' +
            (firstTime && role==='موظف' ? 'إدخال الرصيد الأولي' : 'حفظ الأرصدة') +
          '</button>' +
        '</div>';
        html += '<div id="err-leave" class="form-error" style="display:none"></div>';
        html += '</form></div>';
      }

      html += '</div></div>'; // tabs-body + tabs-container

      el.innerHTML = html;

      // ربط التبويبات
      el.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.onclick = function() {
          el.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('tab-active'); });
          el.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
          this.classList.add('tab-active');
          var panel = document.getElementById(this.dataset.tab);
          if (panel) panel.classList.add('active');
        };
      });

      // ربط النماذج
      _bindBasicForm(isEdit, emp.empId || targetId);
      if (isEdit) {
        _bindRegionForm(emp.empId || targetId);
        _bindEquipForm(emp.empId || targetId);
        _bindLeaveForm(emp.empId || targetId, role, !lv.annBal);
      }
    });
  }

  function _bindBasicForm(isEdit, empId) {
    var form = document.getElementById('form-basic');
    if (!form) return;
    form.onsubmit = function(e) {
      e.preventDefault();
      var errEl = document.getElementById('err-basic');
      var btn   = form.querySelector('[type=submit]');
      errEl.style.display = 'none';

      var phone = CONFIG.toLatinNums((document.getElementById('f-phone') ? document.getElementById('f-phone').value : '').trim());
      if (!CONFIG.validatePhone(phone)) {
        errEl.textContent = 'رقم الجوال يجب أن يبدأ بـ 5 ويتكون من 9 أرقام';
        errEl.style.display = 'block'; return;
      }

      var data = { phone: phone };
      var nameEl = document.getElementById('f-name'); if (nameEl) data.name = nameEl.value.trim();
      var shEl   = document.getElementById('f-shift'); if (shEl) data.shift = shEl.value;
      var roEl   = document.getElementById('f-role');  if (roEl) data.role  = roEl.value;
      var rcEl   = document.getElementById('f-role-code'); if (rcEl) data.roleCode = rcEl.value;
      var weEl   = document.getElementById('f-workExpDate'); if (weEl) data.workExpDate = weEl.value;
      var seEl   = document.getElementById('f-srcExpDate');  if (seEl) data.srcExpDate  = seEl.value;

      App.btnLoad(btn);
      var prom;
      if (isEdit) {
        prom = API.updateEmployee(empId, data);
      } else {
        var idEl = document.getElementById('f-empId');
        data.empId = idEl ? CONFIG.toLatinNums(idEl.value.trim()) : '';
        prom = API.addEmployee(data);
      }
      prom.then(function(res) {
        App.btnDone(btn);
        if (res.ok) { App.toast(isEdit ? 'تم حفظ البيانات الأساسية ✓' : 'تمت إضافة الموظف ✓', 'success'); }
        else {
          var errs = { duplicate_id:'الرقم موجود مسبقاً', duplicate_phone:'الجوال موجود مسبقاً', invalid_role_code:'رمز الترقية غير صحيح' };
          errEl.textContent = errs[res.error] || 'حدث خطأ: ' + res.error;
          errEl.style.display = 'block';
        }
      });
    };
  }

  function _bindRegionForm(empId) {
    var form = document.getElementById('form-region');
    if (!form) return;
    form.onsubmit = function(e) {
      e.preventDefault();
      var btn = form.querySelector('[type=submit]');
      var errEl = document.getElementById('err-region');
      var updates = {
        region: (document.getElementById('rg-region') ? document.getElementById('rg-region').value : ''),
        center: (document.getElementById('rg-center') ? document.getElementById('rg-center').value.trim() : ''),
        car:    (document.getElementById('rg-car')    ? document.getElementById('rg-car').value.trim()    : '')
      };
      App.btnLoad(btn);
      API.updateRegion(empId, updates).then(function(res) {
        App.btnDone(btn);
        if (res.ok) App.toast('تم حفظ المنطقة والمركز ✓', 'success');
        else { errEl.textContent = 'حدث خطأ: ' + res.error; errEl.style.display = 'block'; }
      });
    };
  }

  function _bindEquipForm(empId) {
    var form = document.getElementById('form-equip');
    if (!form) return;
    form.onsubmit = function(e) {
      e.preventDefault();
      var btn = form.querySelector('[type=submit]');
      var errEl = document.getElementById('err-equip');
      var _v = function(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
      var updates = {
        cat2Shirt: _v('eq-cat2shirt'), cat2Pants: _v('eq-cat2pants'),
        shoes:     _v('eq-shoes'),     cat4:      _v('eq-cat4'),
        bravo:     _v('eq-bravo'),     major:     _v('eq-major'),
        other:     _v('eq-other')
      };
      App.btnLoad(btn);
      API.updateEquipment(empId, updates).then(function(res) {
        App.btnDone(btn);
        if (res.ok) App.toast('تم حفظ العدد والمقاسات ✓', 'success');
        else { errEl.textContent = 'حدث خطأ: ' + res.error; errEl.style.display = 'block'; }
      });
    };
  }

  function _bindLeaveForm(empId, role, firstTime) {
    var form = document.getElementById('form-leave');
    if (!form) return;
    form.onsubmit = function(e) {
      e.preventDefault();
      var btn = form.querySelector('[type=submit]');
      var errEl = document.getElementById('err-leave');
      var _n = function(id) { var el = document.getElementById(id); return el && !el.disabled ? el.value : undefined; };
      var updates = {
        annBal:      _n('lv-ann'),    schedBal:    _n('lv-sched'),
        sick:        _n('lv-sick'),   birth:       _n('lv-birth'),
        death:       _n('lv-death'),  marriage:    _n('lv-marr'),
        exam:        _n('lv-exam'),   workCourse:  _n('lv-course'),
        longService: _n('lv-long')
      };
      App.btnLoad(btn);
      API.updateLeaveBalance(empId, updates, firstTime).then(function(res) {
        App.btnDone(btn);
        if (res.ok) App.toast('تم حفظ أرصدة الإجازات ✓', 'success');
        else { errEl.textContent = 'حدث خطأ: ' + res.error; errEl.style.display = 'block'; }
      });
    };
  }

  function _phoneField(val) {
    var latin = val ? CONFIG.toLatinNums(String(val)).replace(/^0/, '') : '';
    return '<div class="form-field">' +
      '<label>رقم الجوال <span class="req">*</span></label>' +
      '<div class="phone-input-merged">' +
        '<span class="phone-flag">🇸🇦</span>' +
        '<span class="phone-cc">+966</span>' +
        '<span class="phone-sep"></span>' +
        '<input type="tel" id="f-phone" class="form-input phone-merged-input" value="' + latin + '" ' +
          'placeholder="5XXXXXXXX" maxlength="9" required inputmode="numeric">' +
      '</div>' +
      '<small class="field-hint">يبدأ بـ 5 — 9 أرقام فقط</small>' +
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

      App.btnLoad(btn);

      var prom;
      if (isEdit) {
        prom = API.updateEmployee(empId, data);
      } else {
        var idEl = document.getElementById('f-empId');
        data.empId = idEl ? idEl.value.trim() : '';
        prom = API.addEmployee(data);
      }

      prom.then(function(res) {
        App.btnDone(btn);
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

  function _inputField2(id, label, val, type) {
    return '<div class="form-field"><label>' + label + '</label>' +
      '<input type="' + (type||'text') + '" id="' + id + '" class="form-input" value="' + (val||'') + '">' +
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
