// ============================================================
// لوحات التحكم — حسب الدور
// ============================================================

var Dashboard = (function () {

  function render(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    var role = Auth.getEffectiveRole();
    var user = Auth.getUser();

    if (role === 'موظف') {
      _renderEmployee(el, user);
    } else {
      _renderManager(el, role, user);
    }
  }

  // ============================================================
  // لوحة الموظف
  // ============================================================
  function _renderEmployee(el, user) {
    var today = CONFIG.todayStr();

    Promise.all([
      API.getDashboard(),
      API.getEmployee(),
      API.getLeaves(),
      API.getRegions(),
      API.getLeaveReqs(),
      API.getOvertimeReqs()
    ]).then(function(results) {
      var dash   = results[0].ok ? results[0].data  : {};
      var emp    = results[1].ok ? results[1].data   : {};
      var lv     = results[2].ok && results[2].data.length ? results[2].data[0] : {};
      var rgList = results[3].ok ? results[3].data   : [];
      var lvReqs = results[4].ok ? results[4].data   : [];
      var otReqs = results[5].ok ? results[5].data   : [];

      // إذا كان المشرف/المدير في وضع الموظف، أظهر بياناته فقط
      var myId = String(user.empId);
      lvReqs = lvReqs.filter(function(r) { return String(r.empId) === myId; });
      otReqs = otReqs.filter(function(r) { return String(r.empId) === myId; });

      // هل الموظف في إجازة اليوم؟
      var onLeave = lvReqs.some(function(r) {
        return r.status === 'approved' && r.startDate <= today && r.endDate >= today;
      });

      // حالة الوردية اليوم
      var shiftSt  = CONFIG.getShiftStatus(user.shift, today);
      var stc      = CONFIG.STATUS[shiftSt.en] || CONFIG.STATUS.off;
      var sk       = CONFIG.shiftKey(user.shift);
      var sc       = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
      var colors   = (dash.colors) || {};

      // إحصاءات الإجازات
      var lvTotal   = lvReqs.length;
      var lvPending = lvReqs.filter(function(r){ return r.status==='pending_review'; }).length;
      var lvDone    = lvReqs.filter(function(r){ return r.status==='approved'||r.status==='rejected'; }).length;

      // إحصاءات الأوفرتايم
      var otTotal   = otReqs.length;
      var otPending = otReqs.filter(function(r){ return r.status==='created'||r.status==='pending_supervisor'; }).length;
      var otDone    = otReqs.filter(function(r){ return r.status==='sent_to_system'||r.status==='received'||r.status==='rejected'; }).length;

      // رقم المنطقة والمركز
      var myRg = rgList.length ? rgList[0] : {};

      var html = '<div class="dashboard-grid emp-dashboard">';

      // ---- 1. بطاقة بياناتي (أولى وكاملة العرض) ----
      html += '<div class="dash-card emp-profile-card">';
      html += '<div class="epc-header" style="background:' + sc.color + '">' +
        '<div class="epc-avatar">' + ((user.name||'?')[0]) + '</div>' +
        '<div class="epc-info">' +
          '<div class="epc-name">' + (user.name||'') + '</div>' +
          '<div class="epc-id">' + (user.empId||'') + '</div>' +
        '</div>' +
        '<div class="epc-shift-badge" style="background:' + stc.bg + ';color:' + stc.text + '">' +
          stc.icon + ' ' + stc.label + ' اليوم' +
        '</div>' +
      '</div>';

      html += '<div class="epc-body">';
      html += _epcRow('الوردية',    'وردية ' + (user.shift||''));
      html += _epcRow('رقم الجوال', emp.phone ? '+966 ' + emp.phone : '—');

      // تواريخ انتهاء البطاقات مع المدة المتبقية
      var _expiryPill = function(date, days) {
        if (!date) return '—';
        var cls = CONFIG.expiryClass(days);
        var bg  = cls ? cls.bg   : '#F5F5F5';
        var tx  = cls ? cls.text : '#757575';
        var rem = (days !== undefined && days !== '') ? ' — ' + days + ' يوم' : '';
        return '<span style="background:' + bg + ';color:' + tx +
               ';padding:2px 10px;border-radius:50px;font-size:0.82rem;font-weight:600">' +
               CONFIG.fmtDate(date) + rem + '</span>';
      };
      html += _epcRow('بطاقة العمل',       _expiryPill(emp.workExpDate, emp.workDaysLeft));
      html += _epcRow('بطاقة مصدر/مستلم', _expiryPill(emp.srcExpDate,  emp.srcDaysLeft));

      html += _epcRow('المنطقة',    myRg.region || '—');
      html += _epcRow('المركز',     myRg.center  || '—');
      html += _epcRow('السيارة',    myRg.car     || '—');
      html += _epcRow('الحالة',
        onLeave
          ? '<span class="status-pill status-leave">🏖️ في إجازة</span>'
          : shiftSt.en === 'off'
            ? '<span class="status-pill status-off">🏠 راحة</span>'
            : '<span class="status-pill status-work">✅ مداوم</span>'
      );
      html += '</div>';

      html += '<div class="epc-footer">' +
        '<button class="btn-sm btn-primary" onclick="App.navigate(\'profile\')">تعديل بياناتي</button>' +
      '</div>';
      html += '</div>'; // emp-profile-card

      // ---- 2. بطاقات الورديات الأربع ----
      html += '<div class="dash-card dash-card-wide">';
      html += '<h3 class="dash-card-title">حالة الورديات اليوم</h3>';
      html += '<div class="shift-cards-row">';
      var shiftStats = dash.shiftStats || {};
      var todayShifts = dash.todayShifts || {};
      ['a','b','c','d'].forEach(function(sk2) {
        var label  = CONFIG.SHIFTS[sk2].label;
        var color  = colors[sk2] || CONFIG.SHIFTS[sk2].color;
        var st2    = todayShifts[sk2] || {};
        var stc2   = CONFIG.STATUS[st2.en] || CONFIG.STATUS.off;
        var stat   = shiftStats[sk2] || {};
        html += '<div class="shift-status-card" style="border-color:' + color + '">' +
          '<div class="ssc-header" style="background:' + color + '">' +
            '<span class="ssc-label">وردية ' + label + '</span>' +
            '<span class="ssc-status">' + stc2.icon + ' ' + (st2.ar||'—') + '</span>' +
          '</div>' +
          '<div class="ssc-body">' +
            '<div class="ssc-stat"><span class="ssc-num">' + (stat.emp||0) + '</span><span>موظف</span></div>' +
            '<div class="ssc-stat"><span class="ssc-num">' + (stat.sup||0) + '</span><span>مشرف</span></div>' +
          '</div>' +
        '</div>';
      });
      html += '</div></div>';

      // ---- 3. بطاقة إجازاتي ----
      html += _reqStatCard('leaves',
        '🏖️', 'إجازاتي',
        lvTotal, lvPending, lvDone,
        '<div class="rsc-balance-box">' +
          '<span class="rsc-bal-label">الرصيد المتبقي</span>' +
          '<span class="rsc-bal-val">' + (lv.annRem !== undefined ? lv.annRem + ' يوم' : '—') + '</span>' +
        '</div>',
        'عرض طلبات الإجازات'
      );

      // ---- 4. بطاقة ساعاتي الإضافية ----
      html += _reqStatCard('overtime',
        '⏱️', 'ساعاتي الإضافية',
        otTotal, otPending, otDone,
        '', 'عرض طلبات العمل الإضافي'
      );

      // ---- 5. بطاقة المراكز والمناطق ----
      html += _buildRegionsCard(rgList, results[2], results[3]);

      html += '</div>'; // dashboard-grid
      el.innerHTML = html;

      // ربط بطاقة المناطق (التوسع)
      var regBtn = document.getElementById('btn-show-regions');
      if (regBtn) {
        regBtn.onclick = function() {
          var panel = document.getElementById('regions-panel');
          if (panel) {
            var isOpen = panel.style.display !== 'none';
            panel.style.display = isOpen ? 'none' : 'block';
            regBtn.textContent  = isOpen ? 'عرض التفاصيل ▼' : 'إخفاء التفاصيل ▲';
          }
        };
      }
    });
  }

  // بطاقة إحصاءات الطلبات (مع إطارات لكل عنصر)
  function _reqStatCard(navTo, icon, title, total, pending, done, extra, linkLabel) {
    return '<div class="dash-card req-stat-card" onclick="App.navigate(\'' + navTo + '\')">' +
      '<div class="rsc-header">' +
        '<span class="rsc-icon-wrap">' + icon + '</span>' +
        '<span class="rsc-title">' + title + '</span>' +
      '</div>' +
      '<div class="rsc-grid">' +
        '<div class="rsc-box rsc-box-total">' +
          '<span class="rsc-box-num">' + total + '</span>' +
          '<span class="rsc-box-label">إجمالي الطلبات</span>' +
        '</div>' +
        '<div class="rsc-box rsc-box-pending">' +
          '<span class="rsc-box-num">' + pending + '</span>' +
          '<span class="rsc-box-label">قيد المراجعة</span>' +
        '</div>' +
        '<div class="rsc-box rsc-box-done">' +
          '<span class="rsc-box-num">' + done + '</span>' +
          '<span class="rsc-box-label">تمت المراجعة</span>' +
        '</div>' +
      '</div>' +
      (extra || '') +
      '<div class="rsc-link-btn">' + linkLabel + ' ◄</div>' +
    '</div>';
  }

  function _epcRow(label, val) {
    return '<div class="epc-row"><span class="epc-label">' + label + '</span><span class="epc-val">' + val + '</span></div>';
  }

  function _rscStat(num, label, color) {
    return '<div class="rsc-stat">' +
      '<span class="rss-num" style="color:' + color + '">' + num + '</span>' +
      '<span class="rss-label">' + label + '</span>' +
    '</div>';
  }

  function _buildRegionsCard(rgList, lvRes2, rgRes2) {
    // رقم المراكز الفريدة والمناطق
    var regions = {};
    rgList.forEach(function(r) {
      if (!r.region) return;
      if (!regions[r.region]) regions[r.region] = [];
      if (r.center && !regions[r.region].includes(r.center)) {
        regions[r.region].push(r.center);
      }
    });
    var regionCount = Object.keys(regions).length;
    var centerCount = Object.values(regions).reduce(function(s, a){ return s + a.length; }, 0);

    var html = '<div class="dash-card regions-card">' +
      '<div class="rsc-header"><span class="rsc-icon-wrap">🗺️</span><span class="rsc-title">المناطق والمراكز</span></div>' +
      '<div class="rsc-grid">' +
        '<div class="rsc-box rsc-box-total">' +
          '<span class="rsc-box-num">' + regionCount + '</span><span class="rsc-box-label">منطقة</span>' +
        '</div>' +
        '<div class="rsc-box rsc-box-pending">' +
          '<span class="rsc-box-num">' + centerCount + '</span><span class="rsc-box-label">مركز</span>' +
        '</div>' +
      '</div>' +
      '<button class="btn-outline rsc-link-btn" id="btn-show-regions" style="width:100%;margin-top:12px;text-align:center">عرض التفاصيل ▼</button>' +
      '<div id="regions-panel" style="display:none;margin-top:12px">';

    if (rgList.length === 0) {
      html += '<div class="empty-state" style="padding:16px">لا توجد بيانات مناطق</div>';
    } else {
      // جدول كل الموظفين
      html += '<div class="regions-table-wrap"><table class="regions-table">' +
        '<thead><tr>' +
          '<th>الرقم الوظيفي</th><th>الاسم</th><th>الوردية</th>' +
          '<th>المنطقة</th><th>المركز</th><th>السيارة</th>' +
        '</tr></thead><tbody>';

      rgList.forEach(function(r) {
        var sk = CONFIG.shiftKey(r.shift||'');
        var sc = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
        html += '<tr>' +
          '<td>' + (r.empId||'—')  + '</td>' +
          '<td>' + (r.name||'—')   + '</td>' +
          '<td><span class="shift-badge-sm" style="background:' + sc.color + ';color:#fff">وردية ' + (r.shift||'—') + '</span></td>' +
          '<td>' + (r.region||'—') + '</td>' +
          '<td>' + (r.center||'—') + '</td>' +
          '<td>' + (r.car||'—')    + '</td>' +
        '</tr>';
      });

      html += '</tbody></table></div>';
    }

    html += '</div></div>'; // regions-panel + regions-card
    return html;
  }

  // ============================================================
  // لوحة المشرف / الإداري / المدير
  // ============================================================
  function _renderManager(el, role, user) {
    var today = CONFIG.todayStr();

    Promise.all([
      API.getDashboard(),
      API.getLeaveReqs(),
      API.getOvertimeReqs(),
      API.getRegions()
    ]).then(function(results) {
      var dash    = results[0].ok ? results[0].data : {};
      var lvReqs  = results[1].ok ? results[1].data : [];
      var otReqs  = results[2].ok ? results[2].data : [];
      var rgList  = results[3].ok ? results[3].data : [];
      var colors  = dash.colors || {};
      var todayShifts = dash.todayShifts || {};
      var shiftStats  = dash.shiftStats  || {};

      var lvPending = lvReqs.filter(function(r){ return r.status==='pending_review'; }).length;
      var otPending = otReqs.filter(function(r){
        return r.status==='created'||r.status==='sent_to_coordinator';
      }).length;

      var html = '<div class="dashboard-grid">';

      // ---- بطاقة الورديات ----
      html += '<div class="dash-card dash-card-wide">';
      html += '<h3 class="dash-card-title">حالة الورديات اليوم</h3>';
      html += '<div class="shift-cards-row">';
      ['a','b','c','d'].forEach(function(sk) {
        var label  = CONFIG.SHIFTS[sk].label;
        var color  = colors[sk] || CONFIG.SHIFTS[sk].color;
        var st2    = todayShifts[sk] || {};
        var stc2   = CONFIG.STATUS[st2.en] || CONFIG.STATUS.off;
        var stat   = shiftStats[sk] || {};
        html += '<div class="shift-status-card" style="border-color:' + color + '">' +
          '<div class="ssc-header" style="background:' + color + '">' +
            '<span class="ssc-label">وردية ' + label + '</span>' +
            '<span class="ssc-status">' + stc2.icon + ' ' + (st2.ar||'—') + '</span>' +
          '</div>' +
          '<div class="ssc-body">' +
            '<div class="ssc-stat"><span class="ssc-num">' + (stat.emp||0) + '</span><span>موظف</span></div>' +
            '<div class="ssc-stat"><span class="ssc-num">' + (stat.sup||0) + '</span><span>مشرف</span></div>' +
          '</div>' +
        '</div>';
      });
      html += '</div></div>';

      // ---- بطاقة المتواجدون والطلبات المعلقة ----
      var od = dash.onDuty || {};
      html += '<div class="dash-card">' +
        '<h3 class="dash-card-title">المتواجدون الآن</h3>' +
        '<div class="on-duty-grid">' +
          '<div class="od-item od-morning"><span class="od-icon">☀</span><span class="od-num">' + (od.morning||0) + '</span><span class="od-label">صباح</span></div>' +
          '<div class="od-item od-evening"><span class="od-icon">🌙</span><span class="od-num">' + (od.evening||0) + '</span><span class="od-label">مساء</span></div>' +
          '<div class="od-item od-total"><span class="od-icon">👥</span><span class="od-num">' + (od.total||0) + '</span><span class="od-label">الإجمالي</span></div>' +
        '</div>' +
      '</div>';

      // ---- بطاقة الطلبات المعلقة ----
      html += '<div class="dash-card">' +
        '<h3 class="dash-card-title">الطلبات المعلقة</h3>' +
        '<div class="pending-grid">' +
          '<div class="pend-item" onclick="App.navigate(\'leaves\')">' +
            '<span class="pend-icon">🏖️</span><span class="pend-num">' + lvPending + '</span><span class="pend-label">إجازات</span>' +
          '</div>' +
          '<div class="pend-item" onclick="App.navigate(\'overtime\')">' +
            '<span class="pend-icon">⏱️</span><span class="pend-num">' + otPending + '</span><span class="pend-label">عمل إضافي</span>' +
          '</div>' +
        '</div>' +
      '</div>';

      // ---- بطاقة المراكز الشاملة (للمدير والمشرف) ----
      html += _buildManagerRegionsCard(rgList, role, today, lvReqs, colors);

      // ---- بطاقة الاستهلاك للمدير ----
      if (role === 'مدير') {
        html += _apiUsageCard();
      }

      html += '</div>';
      el.innerHTML = html;

      // ربط بطاقة المناطق
      var regBtn = document.getElementById('btn-show-regions');
      if (regBtn) {
        regBtn.onclick = function() {
          var panel = document.getElementById('regions-panel');
          if (panel) {
            var isOpen = panel.style.display !== 'none';
            panel.style.display = isOpen ? 'none' : 'block';
            regBtn.textContent  = isOpen ? 'عرض التفاصيل ▼' : 'إخفاء التفاصيل ▲';
          }
        };
      }

      if (role === 'مدير') { _loadApiUsage(); }
    });
  }

  function _buildManagerRegionsCard(rgList, role, today, lvReqs, colors) {
    // الموظفون في إجازة اليوم
    var onLeaveIds = {};
    lvReqs.forEach(function(r) {
      if (r.status === 'approved' && r.startDate <= today && r.endDate >= today) {
        onLeaveIds[String(r.empId)] = true;
      }
    });

    // تجميع حسب المنطقة
    var byRegion = {};
    rgList.forEach(function(r) {
      var reg = r.region || 'غير محدد';
      if (!byRegion[reg]) byRegion[reg] = [];
      byRegion[reg].push(r);
    });

    var regionCount = Object.keys(byRegion).length;
    var centerSet   = {};
    rgList.forEach(function(r) { if (r.center) centerSet[r.center] = true; });
    var centerCount = Object.keys(centerSet).length;

    var html = '<div class="dash-card regions-card dash-card-wide">' +
      '<div class="rsc-header"><span class="rsc-icon-wrap">🗺️</span><span class="rsc-title">المناطق والمراكز</span></div>' +
      '<div class="rsc-grid rsc-grid-4">' +
        '<div class="rsc-box rsc-box-total"><span class="rsc-box-num">' + regionCount + '</span><span class="rsc-box-label">منطقة</span></div>' +
        '<div class="rsc-box rsc-box-pending"><span class="rsc-box-num">' + centerCount + '</span><span class="rsc-box-label">مركز</span></div>' +
        '<div class="rsc-box rsc-box-done"><span class="rsc-box-num">' + rgList.length + '</span><span class="rsc-box-label">موظف</span></div>' +
        '<div class="rsc-box rsc-box-leave"><span class="rsc-box-num">' + Object.keys(onLeaveIds).length + '</span><span class="rsc-box-label">في إجازة</span></div>' +
      '</div>' +
      '<button class="btn-outline rsc-link-btn" id="btn-show-regions" style="width:100%;margin-top:12px;text-align:center">عرض التفاصيل ▼</button>' +
      '<div id="regions-panel" style="display:none;margin-top:12px">';

    Object.keys(byRegion).forEach(function(reg) {
      var emps = byRegion[reg];
      // تجميع حسب المركز
      var byCenters = {};
      emps.forEach(function(e) {
        var c = e.center || 'غير محدد';
        if (!byCenters[c]) byCenters[c] = [];
        byCenters[c].push(e);
      });

      html += '<div class="region-section">' +
        '<div class="region-title">📍 ' + reg + ' <span class="rs-count">(' + emps.length + ' موظف)</span></div>';

      Object.keys(byCenters).forEach(function(center) {
        var cEmps = byCenters[center];
        html += '<div class="center-section">' +
          '<div class="center-title">🏢 ' + center + '</div>' +
          '<div class="regions-table-wrap"><table class="regions-table"><thead><tr>' +
            '<th>الرقم الوظيفي</th><th>الاسم</th><th>الوردية</th><th>المنطقة</th><th>المركز</th><th>السيارة</th>' +
          '</tr></thead><tbody>';

        cEmps.forEach(function(r) {
          var sk = CONFIG.shiftKey(r.shift||'');
          var sc = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
          var onL = onLeaveIds[String(r.empId)];
          html += '<tr' + (onL ? ' class="row-on-leave"' : '') + '>' +
            '<td>' + (r.empId||'—')  + '</td>' +
            '<td>' + (r.name||'—') + (onL ? ' <span class="leave-badge-sm">🏖️ إجازة</span>' : '') + '</td>' +
            '<td><span class="shift-badge-sm" style="background:' + sc.color + ';color:#fff">وردية ' + (r.shift||'—') + '</span></td>' +
            '<td>' + (r.region||'—') + '</td>' +
            '<td>' + (r.center||'—') + '</td>' +
            '<td>' + (r.car||'—')    + '</td>' +
          '</tr>';
        });

        html += '</tbody></table></div></div>'; // center-section
      });

      html += '</div>'; // region-section
    });

    if (rgList.length === 0) {
      html += '<div class="empty-state" style="padding:16px">لا توجد بيانات مناطق</div>';
    }

    html += '</div></div>'; // regions-panel + regions-card
    return html;
  }

  // ---- بطاقة الاستهلاك (المدير فقط) ----
  function _apiUsageCard() {
    return '<div class="dash-card dash-card-wide" id="api-usage-card">' +
      '<h3 class="dash-card-title">📊 بطاقة الاستهلاك — طلبات API اليومية (الحد الأقصى 20,000)</h3>' +
      '<div class="loading-spinner"><div class="spinner small"></div></div>' +
    '</div>';
  }

  function _loadApiUsage() {
    API.getApiUsage().then(function(res) {
      var card = document.getElementById('api-usage-card');
      if (!card || !res.ok) return;
      var d     = res.data;
      var pct   = Math.min(100, d.pct || 0);
      var color = pct >= 96 ? '#EF4444' : pct >= 76 ? '#F97316' : pct >= 61 ? '#EAB308' : '#22C55E';
      var limit = d.limit || 20000;

      var html = '<h3 class="dash-card-title">📊 بطاقة الاستهلاك — طلبات API اليومية (الحد الأقصى ' + limit.toLocaleString() + ')</h3>';
      html += '<div class="api-gauge-container">' +
        '<div class="api-gauge-bar"><div class="api-gauge-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
        '<div class="api-gauge-labels">' +
          '<span style="color:' + color + ';font-weight:700;font-size:1.4rem">' + pct + '%</span>' +
          '<span class="api-count">' + (d.today||0).toLocaleString() + ' / ' + limit.toLocaleString() + ' طلب</span>' +
        '</div>' +
        '<div class="api-gauge-zones">' +
          '<span style="color:#22C55E">0-60% طبيعي</span>' +
          '<span style="color:#EAB308">61-75% تحذير</span>' +
          '<span style="color:#F97316">76-95% إنذار</span>' +
          '<span style="color:#EF4444">96-100% حرج</span>' +
        '</div>' +
      '</div>';

      html += '<div class="api-week-cards">';
      (d.weekData || []).forEach(function(day) {
        var date    = new Date(day.date);
        var dayName = CONFIG.DAYS_AR[date.getDay()];
        var dp      = Math.min(100, Math.round((day.count / limit) * 100));
        var dc      = dp >= 96 ? '#EF4444' : dp >= 76 ? '#F97316' : dp >= 61 ? '#EAB308' : '#22C55E';
        html += '<div class="api-day-card">' +
          '<div class="adc-day">' + dayName + '</div>' +
          '<div class="adc-date">' + date.getDate() + '</div>' +
          '<div class="adc-bar"><div class="adc-fill" style="height:' + dp + '%;background:' + dc + '"></div></div>' +
          '<div class="adc-count">' + day.count + '</div>' +
        '</div>';
      });
      html += '</div>';
      card.innerHTML = html;
    });
  }

  return { render: render };
})();
