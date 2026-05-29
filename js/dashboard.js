// ============================================================
// لوحات التحكم — 4 أدوار
// ============================================================

var Dashboard = (function () {

  function render(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    var role = Auth.getEffectiveRole();

    API.getDashboard().then(function(res) {
      if (!res.ok) { el.innerHTML = '<div class="empty-state">تعذّر تحميل لوحة التحكم</div>'; return; }
      var data = res.data;

      var html = '<div class="dashboard-grid">';

      // بطاقة الورديات (مشترك للجميع)
      html += _shiftStatusCard(data);

      // بطاقة المتواجدون الآن
      html += _onDutyCard(data);

      // بطاقة الطلبات المعلقة
      if (role !== 'موظف') {
        html += _pendingCard(data);
      }

      // بطاقة الموظف (للموظف فقط)
      if (role === 'موظف') {
        html += _employeeQuickCard();
      }

      // بطاقة الاستهلاك (للمدير فقط)
      if (role === 'مدير') {
        html += _apiUsageCard();
      }

      html += '</div>';
      el.innerHTML = html;

      // تحميل بطاقة الاستهلاك بيانات حقيقية
      if (role === 'مدير') {
        _loadApiUsage();
      }

      // تحميل بيانات الموظف
      if (role === 'موظف') {
        _loadEmployeeCard();
      }
    });
  }

  // ---- بطاقة حالة الورديات ----
  function _shiftStatusCard(data) {
    var shifts = data.todayShifts || {};
    var stats  = data.shiftStats  || {};
    var colors = data.colors      || {};

    var html = '<div class="dash-card dash-card-wide">';
    html += '<h3 class="dash-card-title">حالة الورديات اليوم</h3>';
    html += '<div class="shift-cards-row">';

    ['a','b','c','d'].forEach(function(sk) {
      var label  = CONFIG.SHIFTS[sk].label;
      var color  = colors[sk] || CONFIG.SHIFTS[sk].color;
      var st     = shifts[sk] || {};
      var stc    = CONFIG.STATUS[st.en] || CONFIG.STATUS.off;
      var stat   = stats[sk] || {};
      html += '<div class="shift-status-card" style="border-color:' + color + '">' +
        '<div class="ssc-header" style="background:' + color + '">' +
          '<span class="ssc-label">وردية ' + label + '</span>' +
          '<span class="ssc-status">' + stc.icon + ' ' + (st.ar||'—') + '</span>' +
        '</div>' +
        '<div class="ssc-body">' +
          '<div class="ssc-stat"><span class="ssc-num">' + (stat.emp||0) + '</span><span>موظف</span></div>' +
          '<div class="ssc-stat"><span class="ssc-num">' + (stat.sup||0) + '</span><span>مشرف</span></div>' +
        '</div>' +
      '</div>';
    });

    html += '</div></div>';
    return html;
  }

  // ---- بطاقة المتواجدون الآن ----
  function _onDutyCard(data) {
    var od = data.onDuty || {};
    return '<div class="dash-card">' +
      '<h3 class="dash-card-title">المتواجدون الآن</h3>' +
      '<div class="on-duty-grid">' +
        '<div class="od-item od-morning">' +
          '<span class="od-icon">☀</span>' +
          '<span class="od-num">' + (od.morning||0) + '</span>' +
          '<span class="od-label">صباح</span>' +
        '</div>' +
        '<div class="od-item od-evening">' +
          '<span class="od-icon">🌙</span>' +
          '<span class="od-num">' + (od.evening||0) + '</span>' +
          '<span class="od-label">مساء</span>' +
        '</div>' +
        '<div class="od-item od-total">' +
          '<span class="od-icon">👥</span>' +
          '<span class="od-num">' + (od.total||0) + '</span>' +
          '<span class="od-label">الإجمالي</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ---- بطاقة الطلبات المعلقة ----
  function _pendingCard(data) {
    return '<div class="dash-card">' +
      '<h3 class="dash-card-title">الطلبات المعلقة</h3>' +
      '<div class="pending-grid">' +
        '<div class="pend-item" onclick="App.navigate(\'leaves\')">' +
          '<span class="pend-icon">🏖️</span>' +
          '<span class="pend-num">' + (data.pendingLeave||0) + '</span>' +
          '<span class="pend-label">إجازات</span>' +
        '</div>' +
        '<div class="pend-item" onclick="App.navigate(\'overtime\')">' +
          '<span class="pend-icon">⏱️</span>' +
          '<span class="pend-num">' + (data.pendingOT||0) + '</span>' +
          '<span class="pend-label">عمل إضافي</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ---- بطاقة الموظف السريعة ----
  function _employeeQuickCard() {
    return '<div class="dash-card" id="emp-quick-card">' +
      '<h3 class="dash-card-title">بياناتي</h3>' +
      '<div class="loading-spinner"><div class="spinner small"></div></div>' +
    '</div>';
  }

  function _loadEmployeeCard() {
    var user = Auth.getUser();
    if (!user) return;

    Promise.all([
      API.getEmployee(),
      API.getLeaves(),
      API.getRegions()
    ]).then(function(results) {
      var empRes  = results[0];
      var lvRes   = results[1];
      var rgRes   = results[2];
      var card    = document.getElementById('emp-quick-card');
      if (!card) return;

      var emp  = empRes.ok  ? empRes.data  : {};
      var lv   = lvRes.ok && lvRes.data.length ? lvRes.data[0] : {};
      var rg   = rgRes.ok && rgRes.data.length ? rgRes.data[0] : {};
      var st   = CONFIG.getShiftStatus(user.shift, CONFIG.todayStr());
      var stc  = CONFIG.STATUS[st.en] || CONFIG.STATUS.off;
      var sk   = CONFIG.shiftKey(user.shift);
      var sc   = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;

      card.innerHTML =
        '<h3 class="dash-card-title">بياناتي</h3>' +
        '<div class="emp-quick-header" style="background:' + sc.color + '">' +
          '<div class="eqh-name">' + user.name + '</div>' +
          '<div class="eqh-id">' + user.empId + '</div>' +
          '<div class="eqh-status" style="background:' + stc.bg + ';color:' + stc.text + '">' +
            stc.icon + ' ' + stc.label + ' اليوم' +
          '</div>' +
        '</div>' +
        '<div class="emp-quick-body">' +
          _quickRow('الوردية',  'وردية ' + user.shift) +
          _quickRow('المنطقة',  rg.region || '—') +
          _quickRow('المركز',   rg.center  || '—') +
          _quickRow('رصيد الإجازات', (lv.annRem !== undefined ? lv.annRem : '—') + ' يوم') +
          _quickRow('بطاقة العمل', _expiryHtml(emp.workDaysLeft)) +
        '</div>' +
        '<div class="emp-quick-actions">' +
          '<button class="btn-sm btn-primary" onclick="App.navigate(\'profile\')">ملفي الشخصي</button>' +
          '<button class="btn-sm btn-outline" onclick="App.navigate(\'leaves\')">طلب إجازة</button>' +
        '</div>';
    });
  }

  function _quickRow(label, val) {
    return '<div class="quick-row"><span class="qr-label">' + label + '</span><span class="qr-val">' + val + '</span></div>';
  }

  function _expiryHtml(days) {
    if (days === null || days === undefined) return '—';
    var cls = CONFIG.expiryClass(days);
    if (!cls) return '—';
    var txt = days >= 0 ? days + ' يوم' : 'منتهية';
    return '<span style="background:' + cls.bg + ';color:' + cls.text + ';padding:2px 8px;border-radius:99px;font-size:12px">' + txt + '</span>';
  }

  // ---- بطاقة الاستهلاك (المدير فقط) ----
  function _apiUsageCard() {
    return '<div class="dash-card dash-card-wide" id="api-usage-card">' +
      '<h3 class="dash-card-title">بطاقة الاستهلاك — طلبات API اليومية (حد أقصى 20,000)</h3>' +
      '<div class="loading-spinner"><div class="spinner small"></div></div>' +
    '</div>';
  }

  function _loadApiUsage() {
    API.getApiUsage().then(function(res) {
      var card = document.getElementById('api-usage-card');
      if (!card) return;
      if (!res.ok) { card.innerHTML += '<p class="error-text">تعذّر تحميل بيانات الاستهلاك</p>'; return; }

      var d     = res.data;
      var pct   = Math.min(100, d.pct || 0);
      var color = pct >= 96 ? '#EF4444' : pct >= 76 ? '#F97316' : pct >= 61 ? '#EAB308' : '#22C55E';
      var today = d.today  || 0;
      var limit = d.limit  || 20000;

      var html = '<h3 class="dash-card-title">بطاقة الاستهلاك — طلبات API اليومية (حد أقصى ' + limit.toLocaleString() + ')</h3>';

      // شريط التقدم
      html += '<div class="api-gauge-container">' +
        '<div class="api-gauge-bar">' +
          '<div class="api-gauge-fill" style="width:' + pct + '%;background:' + color + '"></div>' +
        '</div>' +
        '<div class="api-gauge-labels">' +
          '<span style="color:' + color + ';font-weight:700;font-size:1.4rem">' + pct + '%</span>' +
          '<span class="api-count">' + today.toLocaleString() + ' / ' + limit.toLocaleString() + ' طلب</span>' +
        '</div>' +
        '<div class="api-gauge-zones">' +
          '<span style="color:#22C55E">0-60% طبيعي</span>' +
          '<span style="color:#EAB308">61-75% تحذير</span>' +
          '<span style="color:#F97316">76-95% إنذار</span>' +
          '<span style="color:#EF4444">96-100% حرج</span>' +
        '</div>' +
      '</div>';

      // بطاقات أيام الأسبوع
      html += '<div class="api-week-cards">';
      var weekData = d.weekData || [];
      weekData.forEach(function(day) {
        var date = new Date(day.date);
        var dayName = CONFIG.DAYS_AR[date.getDay()];
        var dayPct  = Math.min(100, Math.round((day.count / limit) * 100));
        var dc = dayPct >= 96 ? '#EF4444' : dayPct >= 76 ? '#F97316' : dayPct >= 61 ? '#EAB308' : '#22C55E';
        html += '<div class="api-day-card">' +
          '<div class="adc-day">' + dayName + '</div>' +
          '<div class="adc-date">' + date.getDate() + '</div>' +
          '<div class="adc-bar"><div class="adc-fill" style="height:' + dayPct + '%;background:' + dc + '"></div></div>' +
          '<div class="adc-count">' + day.count + '</div>' +
        '</div>';
      });
      html += '</div>';

      card.innerHTML = html;
    });
  }

  return { render: render };
})();
