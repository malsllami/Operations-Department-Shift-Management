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
    // شريط التصدير: المشرف يصدّر وردييته فقط، المدير/الإداري كل الورديات مجمّعة
    var expShift = Auth.isSupervisor() ? Auth.getShift() : '';
    html += Export.inlineBar('employees', expShift);
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
        ((role === 'مدير' || role === 'مشرف' || role === 'اداري') ?
          '<button class="btn-sm btn-card" onclick="App.navigate(\'employee-card\',{empId:\'' + emp.empId + '\'})">بطاقة شاملة</button>' : '') +
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

  // ============================================================
  // بطاقة الموظف الشاملة (مع الأوفرتايم حسب الفترة)
  // ============================================================

  function renderFullCard(containerId, empId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    var targetId = empId || (Auth.getUser() ? String(Auth.getUser().empId) : null);
    var role = Auth.getEffectiveRole();

    if (role === 'موظف') {
      var myId = Auth.getUser() ? String(Auth.getUser().empId) : '';
      if (targetId && String(targetId) !== myId) {
        el.innerHTML = '<div class="empty-state">غير مصرح</div>'; return;
      }
      targetId = myId;
    }

    var dates = _getOtPeriodDates('week');

    Promise.all([
      API.getEmployee(targetId),
      API.getRegions(targetId),
      API.getEquipment(targetId),
      API.getLeaves(targetId),
      API.getOvertimeReqs({ empId: targetId, from: dates.from, to: dates.to })
    ]).then(function(results) {
      var emp    = results[0].ok ? results[0].data : {};
      var rg     = results[1].ok && results[1].data.length ? results[1].data[0] : {};
      var eq     = results[2].ok && results[2].data.length ? results[2].data[0] : {};
      var lv     = results[3].ok && results[3].data.length ? results[3].data[0] : {};
      var otData = results[4].ok ? results[4].data : [];
      _renderCardHtml(el, emp, rg, eq, lv, otData, targetId, 'week');
    });
  }

  function _getOtPeriodDates(period) {
    var today = new Date();
    var to = CONFIG.todayStr();
    var from;
    if (period === 'week') {
      var day = today.getDay();
      var diff = (day === 0) ? -6 : 1 - day;
      var mon = new Date(today);
      mon.setDate(today.getDate() + diff);
      from = mon.getFullYear() + '-' + CONFIG._p(mon.getMonth()+1) + '-' + CONFIG._p(mon.getDate());
    } else if (period === 'month') {
      from = today.getFullYear() + '-' + CONFIG._p(today.getMonth()+1) + '-01';
    } else {
      from = today.getFullYear() + '-01-01';
    }
    return { from: from, to: to };
  }

  function _calcOtHours(otData) {
    var total = 0;
    (otData || []).forEach(function(r) {
      if (r.status !== 'rejected') total += parseFloat(r.hours) || 0;
    });
    return total;
  }

  function _otPeriodTab(period, label, active) {
    return '<button class="ot-period-tab' + (active === period ? ' ot-tab-active' : '') +
      '" data-period="' + period + '">' + label + '</button>';
  }

  function _renderCardHtml(el, emp, rg, eq, lv, otData, targetId, activePeriod) {
    var sk  = CONFIG.shiftKey(emp.shift || '');
    var sc  = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
    var st  = CONFIG.getShiftStatus(emp.shift || '', CONFIG.todayStr());
    var stc = CONFIG.STATUS[st.en] || CONFIG.STATUS.off;

    var html = '<div class="profile-card">';

    html += '<div class="profile-header" style="background:' + sc.color + '">' +
      '<div class="ph-avatar">' + ((emp.name || '?')[0]) + '</div>' +
      '<div class="ph-info">' +
        '<h2>' + (emp.name || '—') + '</h2>' +
        '<p class="ph-sub">' + (emp.empId || '') + ' — ' + (emp.role || '') + '</p>' +
        '<span class="ph-today-status" style="background:' + stc.bg + ';color:' + stc.text + '">' +
          stc.icon + ' ' + stc.label + ' اليوم' +
        '</span>' +
      '</div>' +
    '</div>';

    html += '<div class="profile-sections">';

    html += _section('البيانات الشخصية', [
      ['الاسم',          emp.name    || '—'],
      ['الرقم الوظيفي', emp.empId   || '—'],
      ['رقم الجوال',     emp.phone ? '+966 ' + emp.phone : '—'],
      ['الوردية',        'وردية ' + (emp.shift || '—')],
      ['الصلاحية',       emp.role    || '—'],
      ['تاريخ التسجيل',  CONFIG.fmtDate(emp.regDate)]
    ]);

    html += _section('المنطقة والمركز والسيارة', [
      ['المنطقة',    rg.region || '—'],
      ['المركز',     rg.center || '—'],
      ['رقم السيارة',rg.car    || '—']
    ]);

    html += '<div class="profile-section"><h3 class="section-title">صلاحية البطاقات</h3>' +
      '<div class="expiry-grid">' +
        _expiryRow('بطاقة العمل',       emp.workExpDate, emp.workDaysLeft) +
        _expiryRow('بطاقة مصدر/مستلم', emp.srcExpDate,  emp.srcDaysLeft) +
      '</div></div>';

    html += _section('العدد والمقاسات', [
      ['CAT 2 قميص',   eq.cat2Shirt || '—'],
      ['CAT 2 بنطلون', eq.cat2Pants || '—'],
      ['سيفتي شوز',    eq.shoes     || '—'],
      ['CAT 4 بدلة',   eq.cat4      || '—'],
      ['برافو',         eq.bravo     || '—'],
      ['ميجر',          eq.major     || '—'],
      ['عدد أخرى',      eq.other     || '—']
    ]);

    html += '<div class="profile-section"><h3 class="section-title">أرصدة الإجازة</h3>' +
      '<div class="leave-grid">' +
        _leaveBal('رصيد السنوية',    lv.annBal,     false) +
        _leaveBal('المتبقي السنوية', lv.annRem,     true)  +
        _leaveBal('رصيد المجدولة',   lv.schedBal,   false) +
        _leaveBal('المتبقي المجدولة',lv.schedRem,   false) +
        _leaveBal('مرضية',           lv.sick,        false) +
        _leaveBal('مولود',           lv.birth,       false) +
        _leaveBal('وفاة',            lv.death,       false) +
        _leaveBal('زواج',            lv.marriage,    false) +
        _leaveBal('اختبارات',        lv.exam,        false) +
        _leaveBal('دورة عمل',        lv.workCourse,  false) +
        _leaveBal('خدمة عمل طويلة', lv.longService, false) +
      '</div></div>';

    var otHours = _calcOtHours(otData);
    html += '<div class="profile-section ot-card-section">' +
      '<h3 class="section-title">ساعات العمل الإضافي</h3>' +
      '<div class="ot-period-tabs" id="ot-period-tabs">' +
        _otPeriodTab('week',  'هذا الأسبوع', activePeriod) +
        _otPeriodTab('month', 'هذا الشهر',   activePeriod) +
        _otPeriodTab('year',  'هذه السنة',   activePeriod) +
      '</div>' +
      '<div class="ot-hours-summary">' +
        '<span class="oths-val" id="oths-val">' + otHours + '</span>' +
        '<span class="oths-label">ساعة</span>' +
      '</div>' +
      '<div class="ot-records-count" id="ot-records-count">' +
        otData.length + ' طلب في الفترة المحددة' +
      '</div>' +
    '</div>';

    html += '</div></div>';
    el.innerHTML = html;

    el.querySelectorAll('.ot-period-tab').forEach(function(btn) {
      btn.onclick = function() {
        var period = this.dataset.period;
        var d = _getOtPeriodDates(period);
        el.querySelectorAll('.ot-period-tab').forEach(function(b) {
          b.classList.toggle('ot-tab-active', b.dataset.period === period);
        });
        var valEl = document.getElementById('oths-val');
        var cntEl = document.getElementById('ot-records-count');
        if (valEl) valEl.textContent = '…';
        if (cntEl) cntEl.textContent = '';
        API.getOvertimeReqs({ empId: targetId, from: d.from, to: d.to }).then(function(res) {
          var data  = res.ok ? res.data : [];
          var hours = _calcOtHours(data);
          if (valEl) valEl.textContent = hours;
          if (cntEl) cntEl.textContent = data.length + ' طلب في الفترة المحددة';
        });
      };
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
  // نموذج الموظف الشامل — بطاقات مستقلة
  // ============================================================

  function renderForm(containerId, params, isEdit) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var empId  = params ? (params.empId || (params.emp && params.emp.empId) || '') : '';
    var empInit= params ? params.emp : null;
    var user   = Auth.getUser();
    var role   = Auth.getEffectiveRole();

    if (role === 'موظف' && !empId) empId = user ? String(user.empId) : '';

    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

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

      var eid = emp.empId || targetId;
      var html = '<div class="profile-cards-stack">';

      // ==== بطاقة 1: البيانات الأساسية ====
      html += _cardWrap('👤', 'البيانات الأساسية', '#0066B3',
        '<form id="form-basic" class="form-grid" novalidate>' +
        (isEdit ? _staticField('الرقم الوظيفي', eid) : _inputField('empId','الرقم الوظيفي','','text',true)) +
        _inputField('name','الاسم كامل', emp.name||'','text',true) +
        _phoneField(emp.phone||'') +
        (role !== 'موظف' ? _shiftField(emp.shift||'', role) + _roleField(emp.role||'موظف') : '') +
        _dateField('workExpDate','تاريخ انتهاء بطاقة العمل', emp.workExpDate||'') +
        _dateField('srcExpDate', 'تاريخ انتهاء بطاقة مصدر / مستلم', emp.srcExpDate||'') +
        '<div class="form-actions form-field-full">' +
          '<button type="submit" class="btn-primary">💾 ' + (isEdit?'حفظ البيانات الأساسية':'إضافة الموظف') + '</button>' +
          (!isEdit ? '<button type="button" class="btn-outline" onclick="App.goBack()">إلغاء</button>' : '') +
        '</div>' +
        '<div id="err-basic" class="form-error" style="display:none"></div>' +
        '</form>'
      );

      if (isEdit) {
        // ==== بطاقة 2: المنطقة والمركز ====
        var rgOptions = ['شمال','جنوب','شرق','غرب','وسط'].map(function(v) {
          return '<option value="' + v + '"' + (rg.region===v?' selected':'') + '>' + v + '</option>';
        }).join('');
        html += _cardWrap('📍', 'المنطقة والمركز والسيارة', '#00838F',
          '<form id="form-region" class="form-grid" novalidate>' +
          '<div class="form-field"><label>المنطقة</label>' +
            '<select id="rg-region" class="form-select"><option value="">اختر المنطقة…</option>' + rgOptions + '</select>' +
          '</div>' +
          _inputField2('rg-center','اسم المركز',  rg.center||'','text') +
          _inputField2('rg-car',   'رقم السيارة', rg.car||'',   'text') +
          '<div class="form-actions form-field-full">' +
            '<button type="submit" class="btn-primary">💾 حفظ المنطقة والمركز</button>' +
          '</div>' +
          '<div id="err-region" class="form-error" style="display:none"></div>' +
          '</form>'
        );

        // ==== بطاقة 3: العدد والمقاسات ====
        var eqHtml = '<form id="form-equip" class="form-grid" novalidate>' +
          _inputField2('eq-cat2shirt','CAT 2 قميص',   eq.cat2Shirt||'','text') +
          _inputField2('eq-cat2pants','CAT 2 بنطلون', eq.cat2Pants||'','text') +
          _inputField2('eq-shoes',    'سيفتي شوز',    eq.shoes||'',    'text') +
          _inputField2('eq-cat4',     'CAT 4 بدلة',   eq.cat4||'',     'text') +
          _inputField2('eq-bravo',    'برافو',          eq.bravo||'',    'text') +
          _inputField2('eq-major',    'ميجر',           eq.major||'',    'text') +
          _inputField2('eq-other',    'عدد أخرى',      eq.other||'',    'text') +
          '<div class="form-actions form-field-full">' +
            '<button type="submit" class="btn-primary">💾 حفظ العدد والمقاسات</button>' +
          '</div>' +
          '<div id="err-equip" class="form-error" style="display:none"></div>' +
          '</form>';
        html += _cardWrap('🦺', 'العدد والمقاسات', '#2E7D32', eqHtml);

        // ==== بطاقة 4: أرصدة الإجازات ====
        var firstTime = !lv.annBal;
        var lvHint = (role==='موظف' && !firstTime)
          ? '<div class="form-warning">⚠️ يمكن إدخال الرصيد أول مرة فقط — للتعديل تواصل مع المشرف</div>' : '';
        var lvHtml = '<form id="form-leave" novalidate>' + lvHint +
          '<div class="leave-edit-grid">' +
          [
            {id:'lv-ann',   lbl:'رصيد السنوي',       val:lv.annBal||'',     dis:role==='موظف'&&!!lv.annBal},
            {id:'lv-sched', lbl:'رصيد المجدولة',      val:lv.schedBal||'',   dis:role==='موظف'},
            {id:'lv-sick',  lbl:'مرضية',              val:lv.sick||'',       dis:false},
            {id:'lv-birth', lbl:'مولود',              val:lv.birth||'',      dis:false},
            {id:'lv-death', lbl:'وفاة',               val:lv.death||'',      dis:false},
            {id:'lv-marr',  lbl:'زواج',               val:lv.marriage||'',   dis:false},
            {id:'lv-exam',  lbl:'اختبارات',           val:lv.exam||'',       dis:false},
            {id:'lv-course',lbl:'دورة عمل',           val:lv.workCourse||'', dis:false},
            {id:'lv-long',  lbl:'خدمة عمل طويلة',    val:lv.longService||'',dis:false}
          ].map(function(f) {
            return '<div class="leave-edit-item' + (f.dis?' leave-disabled':'') + '">' +
              '<span class="lei-label">' + f.lbl + '</span>' +
              '<input type="number" id="' + f.id + '" class="lei-input" value="' + f.val + '" min="0"' +
              (f.dis?' disabled':'') + '>' +
            '</div>';
          }).join('') +
          '</div>' +
          '<div class="form-actions" style="margin-top:14px">' +
            '<button type="submit" class="btn-primary"' + (role==='موظف'&&!firstTime?' disabled':'') + '>💾 ' +
            (firstTime&&role==='موظف'?'إدخال الرصيد الأولي':'حفظ الأرصدة') + '</button>' +
          '</div>' +
          '<div id="err-leave" class="form-error" style="display:none"></div>' +
          '</form>';
        html += _cardWrap('📅', 'أرصدة الإجازات', '#6A1B9A', lvHtml);

        // ==== بطاقة 5: تغيير الرقم السري ====
        var pwHtml = '<form id="form-pw" novalidate>' +
          '<div class="form-grid">' +
          '<div class="form-field form-field-full"><label>كلمة المرور الجديدة <span class="req">*</span></label>' +
            '<div class="pw-wrap"><input type="password" id="pw-new" class="form-input" placeholder="6 أحرف على الأقل" autocomplete="new-password">' +
              '<button type="button" class="pw-eye" onclick="App.togglePw(\'pw-new\',this)">' +
                '<svg viewBox="0 0 24 24" width="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="form-field form-field-full"><label>تأكيد كلمة المرور <span class="req">*</span></label>' +
            '<div class="pw-wrap"><input type="password" id="pw-confirm" class="form-input" placeholder="أعد الكتابة" autocomplete="new-password">' +
              '<button type="button" class="pw-eye" onclick="App.togglePw(\'pw-confirm\',this)">' +
                '<svg viewBox="0 0 24 24" width="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '</div>' +
          '<div class="pass-rules" style="margin:10px 0">' +
            '<span id="pw-r-len"  class="pass-rule">✗ 6 أحرف على الأقل</span>' +
            '<span id="pw-r-diff" class="pass-rule">✗ مختلفة عن 123456</span>' +
            '<span id="pw-r-mtch" class="pass-rule">✗ متطابقتان</span>' +
          '</div>' +
          '<div class="form-actions">' +
            '<button type="submit" class="btn-primary" id="pw-btn" disabled>🔐 تغيير الرقم السري</button>' +
          '</div>' +
          '<div id="err-pw" class="form-error" style="display:none"></div>' +
          '</form>';
        html += _cardWrap('🔐', 'تغيير الرقم السري', '#B71C1C', pwHtml);
      }

      html += '</div>'; // profile-cards-stack
      el.innerHTML = html;

      // ---- ربط النماذج ----
      _bindBasicForm(isEdit, eid);
      if (isEdit) {
        _bindRegionForm(eid);
        _bindEquipForm(eid);
        _bindLeaveForm(eid, role, !lv.annBal);
        _bindPwForm();
      }
    });
  }

  function _cardWrap(icon, title, color, bodyHtml) {
    return '<div class="pf-section-card">' +
      '<div class="pfc-header" style="background:' + color + '">' +
        '<span class="pfc-icon">' + icon + '</span>' +
        '<span class="pfc-title">' + title + '</span>' +
      '</div>' +
      '<div class="pfc-body">' + bodyHtml + '</div>' +
    '</div>';
  }

  function _bindPwForm() {
    var form    = document.getElementById('form-pw');
    var newEl   = document.getElementById('pw-new');
    var conEl   = document.getElementById('pw-confirm');
    var btn     = document.getElementById('pw-btn');
    var rLen    = document.getElementById('pw-r-len');
    var rDiff   = document.getElementById('pw-r-diff');
    var rMtch   = document.getElementById('pw-r-mtch');
    if (!form) return;

    function _check() {
      var np = newEl ? newEl.value : '';
      var cp = conEl ? conEl.value : '';
      var okLen  = np.length >= 6;
      var okDiff = np !== '123456';
      var okMtch = np.length > 0 && np === cp;
      if (rLen)  { rLen.className  = 'pass-rule ' + (okLen  ?'pass-ok':'pass-fail'); rLen.textContent  = (okLen ?'✓':'✗') + ' 6 أحرف على الأقل'; }
      if (rDiff) { rDiff.className = 'pass-rule ' + (okDiff ?'pass-ok':'pass-fail'); rDiff.textContent = (okDiff?'✓':'✗') + ' مختلفة عن 123456'; }
      if (rMtch) { rMtch.className = 'pass-rule ' + (okMtch ?'pass-ok':'pass-fail'); rMtch.textContent = (okMtch?'✓':'✗') + ' متطابقتان'; }
      if (btn) btn.disabled = !(okLen && okDiff && okMtch);
    }
    if (newEl) newEl.addEventListener('input', _check);
    if (conEl) conEl.addEventListener('input', _check);

    form.onsubmit = function(e) {
      e.preventDefault();
      var errEl = document.getElementById('err-pw');
      if (!newEl || !conEl) return;
      if (newEl.value !== conEl.value) { errEl.textContent = 'كلمتا المرور غير متطابقتين'; errEl.style.display='block'; return; }
      App.btnLoad(btn);
      Auth.changePassword(newEl.value).then(function(res) {
        App.btnDone(btn);
        if (res.ok) {
          App.toast('تم تغيير الرقم السري بنجاح ✓', 'success');
          newEl.value = ''; conEl.value = ''; _check();
        } else {
          var errs = { password_too_short:'كلمة المرور قصيرة', password_same_as_default:'لا يمكن استخدام الكلمة الافتراضية' };
          errEl.textContent = errs[res.error] || 'حدث خطأ';
          errEl.style.display = 'block';
        }
      });
    };
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
    renderList, renderProfile, renderFullCard, viewProfile, editEmployee, renderForm,
    transferDialog, _roleChange,
    getCache: function() { return _cache; }
  };
})();
