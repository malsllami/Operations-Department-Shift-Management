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
        return r.status === 'معتمد' && r.startDate <= today && r.endDate >= today;
      });

      // حالة الوردية اليوم
      var shiftSt  = CONFIG.getShiftStatus(user.shift, today);
      var stc      = CONFIG.STATUS[shiftSt.en] || CONFIG.STATUS.off;
      var sk       = CONFIG.shiftKey(user.shift);
      var sc       = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
      var colors   = (dash.colors) || {};

      // إحصاءات الإجازات
      var lvTotal   = lvReqs.length;
      var lvPending = lvReqs.filter(function(r){ return r.status==='قيد المراجعة'; }).length;
      var lvDone    = lvReqs.filter(function(r){ return r.status==='معتمد'||r.status==='مرفوض'; }).length;

      // إحصاءات الأوفرتايم
      var otTotal   = otReqs.length;
      var otPending = otReqs.filter(function(r){ return r.status==='تم الإنشاء'||r.status==='قيد مراجعة المشرف'; }).length;
      var otDone    = otReqs.filter(function(r){ return r.status==='تم الإرسال للنظام'||r.status==='تم الاستلام'||r.status==='مرفوض'; }).length;

      // رقم المنطقة والمركز
      var myRg = rgList.length ? rgList[0] : {};

      var html = '<div class="dashboard-grid emp-dashboard">';

      // ---- 1. بطاقة بياناتي (أولى وكاملة العرض) — قابلة للضغط ----
      html += '<div class="dash-card emp-profile-card" onclick="App.navigate(\'employee-card\')" title="اضغط لعرض وتعديل بطاقتك الشاملة" style="cursor:pointer">';
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
      html += _epcRow('رقم الجوال', emp.phone ? '<span class="phone-display">🇸🇦 +966 ' + CONFIG.normPhone(emp.phone) + '</span>' : '—');

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
        '<button class="btn-sm btn-primary" onclick="event.stopPropagation();App.navigate(\'employee-card\')">✏️ بطاقتي الكاملة والتعديل</button>' +
      '</div>';
      html += '</div>'; // emp-profile-card

      var shiftStats  = dash.shiftStats  || {};
      var todayShifts = dash.todayShifts || {};

      // ---- 2. إجازاتي ----
      html += _reqStatCard('leaves',
        '🏖️', 'إجازاتي',
        lvTotal, lvPending, lvDone,
        '<div class="rsc-balance-box">' +
          '<span class="rsc-bal-label">الرصيد المتبقي</span>' +
          '<span class="rsc-bal-val">' + (lv.annRem !== undefined ? lv.annRem + ' يوم' : '—') + '</span>' +
        '</div>',
        'عرض طلبات الإجازات'
      );

      // ---- 3. ساعاتي الإضافية ----
      html += _reqStatCard('overtime',
        '⏱️', 'ساعاتي الإضافية',
        otTotal, otPending, otDone,
        '', 'عرض طلبات العمل الإضافي'
      );

      // ---- 4. تصدير بياناتي ----
      html += '<div class="dash-card emp-export-card">' +
        '<div class="rsc-header"><span class="rsc-icon-wrap">📤</span><span class="rsc-title">تصدير بياناتي</span></div>' +
        '<p class="emp-exp-desc">تصدير ملف Excel يحتوي 3 ورقات:</p>' +
        '<ul class="emp-exp-list">' +
          '<li><span class="emp-exp-dot" style="background:#00838F"></span>أرصدة الإجازات</li>' +
          '<li><span class="emp-exp-dot" style="background:#2E7D32"></span>طلبات الإجازات</li>' +
          '<li><span class="emp-exp-dot" style="background:#6A1B9A"></span>العمل الإضافي</li>' +
        '</ul>' +
        '<button class="btn-primary emp-exp-btn" onclick="Export.exportEmployee()">📊 تصدير Excel</button>' +
      '</div>';

      // ---- 5. حالة الورديات — بطاقة واحدة أنيقة ----
      html += '<div class="dash-card dash-card-wide emp-shifts-card">';
      html += '<h3 class="dash-card-title">📊 حالة الورديات اليوم</h3>';
      html += '<div class="emp-shift-strips">';
      ['a','b','c','d'].forEach(function(sk2) {
        var label  = CONFIG.SHIFTS[sk2].label;
        var color  = colors[sk2] || CONFIG.SHIFTS[sk2].color;
        var st2    = todayShifts[sk2] || {};
        var stc2   = CONFIG.STATUS[st2.en] || CONFIG.STATUS.off;
        var stat   = shiftStats[sk2] || {};
        var isMyShift = CONFIG.shiftKey(user.shift) === sk2;
        html += '<div class="ess-strip' + (isMyShift ? ' ess-mine' : '') + '" style="border-right:4px solid ' + color + '">' +
          '<div class="ess-shift-badge" style="background:' + color + ';color:#fff">وردية ' + label + '</div>' +
          '<div class="ess-status-badge" style="background:' + stc2.bg + ';color:' + stc2.text + '">' +
            stc2.icon + ' ' + (st2.ar || '—') +
          '</div>' +
          '<div class="ess-counts">' +
            '<span class="ess-count"><strong>' + (stat.emp||0) + '</strong> موظف</span>' +
            '<span class="ess-sep">·</span>' +
            '<span class="ess-count"><strong>' + (stat.sup||0) + '</strong> مشرف</span>' +
          '</div>' +
          (isMyShift ? '<div class="ess-mine-tag">وردييتي</div>' : '') +
        '</div>';
      });
      html += '</div></div>';

      // ---- 6. خريطة المحطات ----
      html += '<div class="dash-card emp-maps-card" onclick="App.navigate(\'substations\')" style="cursor:pointer">' +
        '<div class="rsc-header">' +
          '<span class="rsc-icon-wrap" style="background:linear-gradient(135deg,#E8A54B,#D4923A)">⚡</span>' +
          '<span class="rsc-title">خريطة المحطات</span>' +
        '</div>' +
        '<p class="emp-maps-desc">بحث عن محطة، إضافة محطة توزيع أو تحويل، ومتابعة الأعطال</p>' +
        '<div class="emp-maps-btns">' +
          '<span class="emp-maps-tag mmt-search">🔍 بحث</span>' +
          '<span class="emp-maps-tag mmt-dist">+ توزيع</span>' +
          '<span class="emp-maps-tag mmt-sub">+ تحويل</span>' +
          '<span class="emp-maps-tag mmt-fault">⚠ اعطال</span>' +
        '</div>' +
      '</div>';

      // ---- 7. المراكز والمناطق ----
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
          '<td><span class="shift-badge-sm" style="background:' + sc.color + ';color:#fff">' + (r.shift||'—') + '</span></td>' +
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

    // ----
    // المرحلة الأولى: طلبان فقط — getDashboard يرجع العدادات والألوان
    // getRegions + getEmployees تُحمَّل بعد العرض الأولي
    // ----
    Promise.all([
      API.getDashboard(),
      API.getRegions()
    ]).then(function(results) {
      var dash    = results[0].ok ? results[0].data : {};
      var rgList  = results[1].ok ? results[1].data : [];
      var lvReqs  = [];   // تُحمَّل في المرحلة الثانية
      var empList = [];
      var colors  = dash.colors || {};
      var todayShifts = dash.todayShifts || {};
      var shiftStats  = dash.shiftStats  || {};

      var isSup = role === 'مشرف';
      // العدادات تأتي من getDashboard مباشرةً (بدون طلب منفصل)
      var lvPending = dash.pendingLeave || 0;
      var otPending = dash.pendingOT    || 0;

      // تجميع عدد الموظفين حسب المنطقة لكل وردية (من rgList)
      var shiftRegions = { a:{}, b:{}, c:{}, d:{} };
      var shiftMap = { 'أ':'a','ب':'b','ج':'c','د':'d' };
      rgList.forEach(function(r) {
        if (!r.region) return;
        var sk2 = shiftMap[r.shift] || 'a';
        shiftRegions[sk2][r.region] = (shiftRegions[sk2][r.region] || 0) + 1;
      });

      var html = '<div class="dashboard-grid' + (isSup ? ' sup-dashboard' : '') + '">';

      // ============================================================
      // 0. بطاقة الاستهلاك — أول عنصر للمدير فقط
      // ============================================================
      if (role === 'مدير') html += _apiUsageCard();

      // ============================================================
      // 1. بطاقة التصدير السريع — ثاني عنصر لدى المدير والإداري
      // ============================================================
      if (role === 'مدير' || role === 'اداري') {
        html += '<div class="dash-card dash-card-wide dash-export-card">' +
          '<h3 class="dash-card-title">📤 تصدير البيانات السريع</h3>' +
          '<div class="dash-export-grid">' +
            '<div class="dash-exp-section">' +
              '<div class="dash-exp-label">الموظفون</div>' +
              '<div class="dash-exp-btns">' +
                '<button class="btn-exp-sm btn-exp-xl" onclick="Export.quickExport(\'employees\',\'\',\'excel\')">📊 Excel</button>' +
                '<button class="btn-exp-sm btn-exp-pr"  onclick="Export.quickExport(\'employees\',\'\',\'print\')">🖨️ طباعة</button>' +
              '</div>' +
            '</div>' +
            '<div class="dash-exp-section">' +
              '<div class="dash-exp-label">طلبات الإجازات</div>' +
              '<div class="dash-exp-btns">' +
                '<button class="btn-exp-sm btn-exp-xl" onclick="Export.quickExport(\'leaves\',\'\',\'excel\')">📊 Excel</button>' +
                '<button class="btn-exp-sm btn-exp-pr"  onclick="Export.quickExport(\'leaves\',\'\',\'print\')">🖨️ طباعة</button>' +
              '</div>' +
            '</div>' +
            '<div class="dash-exp-section">' +
              '<div class="dash-exp-label">العمل الإضافي</div>' +
              '<div class="dash-exp-btns">' +
                '<button class="btn-exp-sm btn-exp-xl" onclick="Export.quickExport(\'overtime\',\'\',\'excel\')">📊 Excel</button>' +
                '<button class="btn-exp-sm btn-exp-pr"  onclick="Export.quickExport(\'overtime\',\'\',\'print\')">🖨️ طباعة</button>' +
              '</div>' +
            '</div>' +
            '<div class="dash-exp-section dash-exp-comp">' +
              '<div class="dash-exp-label">تصدير شامل (4 جداول)</div>' +
              '<div class="dash-exp-btns">' +
                '<button class="btn-exp-sm btn-exp-xl" onclick="Dashboard.quickComprehensive(\'excel\')">📊 Excel شامل</button>' +
                '<button class="btn-exp-sm btn-exp-pr"  onclick="Dashboard.quickComprehensive(\'print\')">🖨️ طباعة</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div style="text-align:left;margin-top:8px">' +
            '<button class="btn-outline" style="font-size:0.8rem;padding:4px 14px" onclick="App.navigate(\'export\')">⚙️ خيارات التصدير المتقدمة</button>' +
          '</div>' +
        '</div>';
      }

      // ============================================================
      // 1. بطاقات الورديات — قابلة للنقر لفتح جدول الوردية
      // ============================================================
      html += '<div class="dash-card dash-card-wide">';
      html += '<h3 class="dash-card-title">📊 حالة الورديات اليوم <span style="font-size:0.75rem;font-weight:400;color:var(--text-muted)">— اضغط على الوردية لعرض موظفيها</span></h3>';
      html += '<div class="shift-cards-row">';
      var shiftKeys = isSup ? [CONFIG.shiftKey(user.shift || 'أ')] : ['a','b','c','d'];
      shiftKeys.forEach(function(sk) {
        var label  = CONFIG.SHIFTS[sk].label;
        var color  = colors[sk] || CONFIG.SHIFTS[sk].color;
        var st2    = todayShifts[sk] || {};
        var stc2   = CONFIG.STATUS[st2.en] || CONFIG.STATUS.off;
        var stat   = shiftStats[sk] || {};

        // تفصيل المناطق لهذه الوردية
        var regData = shiftRegions[sk] || {};
        var regKeys = Object.keys(regData);
        var regHtml = regKeys.length
          ? '<div class="ssc-regions">' + regKeys.map(function(reg) {
              return '<div class="ssc-reg-row"><span class="ssc-reg-name">📍 ' + reg + '</span><span class="ssc-reg-count">' + regData[reg] + '</span></div>';
            }).join('') + '</div>'
          : '';

        html += '<div class="shift-status-card ssc-clickable" style="border-color:' + color + '" ' +
          'onclick="App.navigate(\'employees\',{filterShift:\'' + label + '\'})" title="اضغط لعرض موظفي وردية ' + label + '">' +
          '<div class="ssc-header" style="background:' + color + '">' +
            '<span class="ssc-label">وردية ' + label + '</span>' +
            '<span class="ssc-status">' + stc2.icon + ' ' + (st2.ar||'—') + '</span>' +
          '</div>' +
          '<div class="ssc-body">' +
            '<div class="ssc-stat"><span class="ssc-num">' + (stat.emp||0) + '</span><span>موظف</span></div>' +
            '<div class="ssc-stat"><span class="ssc-num">' + (stat.sup||0) + '</span><span>مشرف</span></div>' +
          '</div>' +
          regHtml +
          '<div class="ssc-footer" style="background:' + stc2.bg + ';color:' + stc2.text + '">' +
            stc2.icon + ' ' + (st2.ar||'راحة') + ' اليوم' +
          '</div>' +
        '</div>';
      });
      html += '</div></div>';

      // ============================================================
      // 2. المتواجدون الآن — حسب الدور
      //    مشرف: وردييته فقط | مدير: الكل | اداري: مخفي
      // ============================================================
      if (role !== 'اداري') {
        var od, odTitle;
        if (role === 'مشرف') {
          // حساب المتواجدين من وردية المشرف فقط
          var mySk   = CONFIG.shiftKey(user.shift || '');
          var myStat = shiftStats[mySk] || {};
          var mySt   = todayShifts[mySk] || {};
          var myTotal = (myStat.emp||0) + (myStat.sup||0);
          var myMorning = mySt.en === 'morning' ? myTotal : 0;
          var myEvening = mySt.en === 'evening' ? myTotal : 0;
          od = { morning: myMorning, evening: myEvening, total: myTotal };
          odTitle = 'المتواجدون — وردية ' + (user.shift||'');
        } else {
          od = dash.onDuty || {};
          odTitle = 'المتواجدون الآن';
        }
        html += '<div class="dash-card">' +
          '<h3 class="dash-card-title">👥 ' + odTitle + '</h3>' +
          '<div class="on-duty-grid">' +
            '<div class="od-item od-morning"><span class="od-icon">☀</span><span class="od-num">' + (od.morning||0) + '</span><span class="od-label">صباح</span></div>' +
            '<div class="od-item od-evening"><span class="od-icon">🌙</span><span class="od-num">' + (od.evening||0) + '</span><span class="od-label">مساء</span></div>' +
            '<div class="od-item od-total"><span class="od-icon">👥</span><span class="od-num">' + (od.total||0) + '</span><span class="od-label">الإجمالي</span></div>' +
          '</div>' +
        '</div>';
      }

      // ============================================================
      // 3. الطلبات المعلقة
      // ============================================================
      html += '<div class="dash-card">' +
        '<h3 class="dash-card-title">⏳ الطلبات المعلقة</h3>' +
        '<div class="pending-grid">' +
          '<div class="pend-item" onclick="App.navigate(\'leaves\')">' +
            '<span class="pend-icon">🏖️</span><span class="pend-num">' + lvPending + '</span><span class="pend-label">إجازات</span>' +
          '</div>' +
          '<div class="pend-item" onclick="App.navigate(\'overtime\')">' +
            '<span class="pend-icon">⏱️</span><span class="pend-num">' + otPending + '</span><span class="pend-label">عمل إضافي</span>' +
          '</div>' +
        '</div>' +
      '</div>';

      // ============================================================
      // 3b. إعدادات الحضور (المشرف فقط)
      // ============================================================
      if (isSup) html += _buildPresenceSettingsCard();

      // ============================================================
      // 3c. توزيع الإجازات (المشرف فقط)
      // ============================================================
      if (isSup) html += _buildLeaveDistCard(lvReqs, user.shift, rgList, today);

      // ============================================================
      // 4. بطاقة المراكز والمناطق الشاملة
      // ============================================================
      html += _buildManagerRegionsCard(rgList, role, today, lvReqs, colors, todayShifts, user.shift);

      // ============================================================
      // 5. بطاقة تواريخ البطاقات (placeholder — تُحدَّث في المرحلة الثانية)
      // ============================================================
      html += '<div class="dash-card dash-card-wide ce-card">' +
        '<div class="rsc-header"><span class="rsc-icon-wrap">🪪</span>' +
          '<span class="rsc-title">صلاحيات البطاقات والهويات</span></div>' +
        '<div style="padding:20px;text-align:center;color:#94A3B8;font-size:0.85rem">' +
          '<div class="spinner" style="margin:0 auto 8px"></div>جارٍ التحميل…</div>' +
      '</div>';

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
            regBtn.textContent  = isOpen ? '▼ عرض التفاصيل' : '▲ إخفاء التفاصيل';
          }
        };
      }

      // ربط بطاقة البطاقات
      var ceBtn = document.getElementById('btn-show-ce');
      if (ceBtn) {
        ceBtn.onclick = function() {
          var panel = document.getElementById('ce-panel');
          if (panel) {
            var isOpen = panel.style.display !== 'none';
            panel.style.display = isOpen ? 'none' : 'block';
            ceBtn.textContent   = isOpen ? 'عرض تفاصيل البطاقات ▼' : 'إخفاء تفاصيل البطاقات ▲';
          }
        };
      }

      if (role === 'مدير') { _loadApiUsage(); }
      if (isSup) { _loadPresenceDefaults(); }

      // ----
      // المرحلة الثانية: تحميل الإجازات والموظفين بعد رسم الصفحة
      // يُحدّث بطاقة المناطق + توزيع الإجازات + تواريخ البطاقات
      // ----
      var _el = el;
      var _role = role, _user2 = user, _rgList = rgList, _today = today;
      var _isSup = isSup;
      Promise.all([
        API.getLeaveReqs(),
        API.getEmployees()
      ]).then(function(r2) {
        var lv2  = r2[0].ok ? r2[0].data : [];
        var emp2 = r2[1].ok ? r2[1].data : [];
        if (!_el || !document.body.contains(_el)) return; // تحقق أن الصفحة لا تزال مفتوحة

        // تحديث بطاقة المناطق
        var rgCard = _el.querySelector('.regions-card');
        if (rgCard) {
          rgCard.outerHTML = _buildManagerRegionsCard(_rgList, _role, _today, lv2, colors, todayShifts, _user2.shift);
          // إعادة ربط زر المناطق
          var regBtn2 = _el.querySelector('#btn-show-regions');
          if (regBtn2) regBtn2.onclick = function() {
            var p2 = _el.querySelector('#regions-panel');
            if (p2) { var o2 = p2.style.display !== 'none'; p2.style.display = o2 ? 'none' : 'block'; this.textContent = o2 ? '▼ عرض التفاصيل' : '▲ إخفاء التفاصيل'; }
          };
        }

        // تحديث بطاقة توزيع الإجازات (المشرف فقط)
        if (_isSup) {
          var distCard = _el.querySelector('.lv-dist-card');
          if (distCard) distCard.outerHTML = _buildLeaveDistCard(lv2, _user2.shift, _rgList, _today);
        }

        // تحديث بطاقة تواريخ البطاقات
        var ceCard = _el.querySelector('.ce-card');
        if (ceCard) {
          ceCard.outerHTML = _buildCardExpiryCard(emp2, _role, _user2.shift);
          var ceBtn2 = _el.querySelector('#btn-show-ce');
          if (ceBtn2) ceBtn2.onclick = function() {
            var p3 = _el.querySelector('#ce-panel');
            if (p3) { var o3 = p3.style.display !== 'none'; p3.style.display = o3 ? 'none' : 'block'; this.textContent = o3 ? 'عرض تفاصيل البطاقات ▼' : 'إخفاء تفاصيل البطاقات ▲'; }
          };
        }
      }).catch(function() {}); // أخطاء المرحلة الثانية لا تؤثر على الصفحة
    });
  }

  // ============================================================
  // بطاقة توزيع الإجازات — المشرف
  // ============================================================
  var _lvYearData  = null;
  var _lvEmpRegion = {};

  function _buildLeaveDistCard(lvReqs, myShift, rgList, today) {
    if (!lvReqs || !lvReqs.length) {
      return '<div class="dash-card lv-dist-card">' +
        '<div class="rsc-header"><span class="rsc-icon-wrap">📊</span>' +
          '<span class="rsc-title">توزيع الإجازات — وردية ' + myShift + '</span></div>' +
        '<div style="padding:20px;text-align:center;color:#94A3B8;font-size:0.85rem">' +
          '<div class="spinner" style="margin:0 auto 8px"></div>جارٍ تحميل بيانات الإجازات…</div>' +
      '</div>';
    }
    var approved = lvReqs.filter(function(r) {
      return r.status === 'معتمد' && r.shift === myShift;
    });

    _lvEmpRegion = {};
    rgList.forEach(function(r) {
      if (r.shift === myShift) _lvEmpRegion[String(r.empId)] = r.region || '—';
    });

    var totalShift = Object.keys(_lvEmpRegion).length || 10;
    var highThr    = Math.max(2, Math.ceil(totalShift * 0.4));
    var medThr     = Math.max(1, Math.ceil(totalShift * 0.2));

    var curYear  = parseInt(today.substring(0, 4));
    var curMonth = parseInt(today.substring(5, 7));

    var MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

    function _monthLeaves(year, month) {
      var mm   = month < 10 ? '0' + month : '' + month;
      var last = new Date(year, month, 0).getDate();
      var ll   = last < 10 ? '0' + last : '' + last;
      var s = year + '-' + mm + '-01';
      var e = year + '-' + mm + '-' + ll;
      return approved.filter(function(r) { return r.startDate <= e && r.endDate >= s; });
    }

    function _barColor(n) {
      if (n === 0)      return '#E5E7EB';
      if (n >= highThr) return '#EF4444';
      if (n >= medThr)  return '#F59E0B';
      return '#22C55E';
    }

    function _buildTooltip(leaves, name) {
      var reg = {}; leaves.forEach(function(r) {
        var k = _lvEmpRegion[String(r.empId)] || '—'; reg[k] = (reg[k]||0)+1;
      });
      var t = name + ': ' + leaves.length + ' إجازة';
      Object.keys(reg).forEach(function(k) { t += '\n• ' + k + ': ' + reg[k]; });
      return t;
    }

    // ---- بيانات السنة ----
    _lvYearData = [];
    for (var m = 1; m <= 12; m++) {
      _lvYearData.push({ m: m, name: MONTHS[m-1], leaves: _monthLeaves(curYear, m) });
    }
    var maxY = _lvYearData.reduce(function(mx, d) { return Math.max(mx, d.leaves.length); }, 0) || 1;

    var legend = '<div class="lv-legend">' +
      '<span class="lv-leg-item"><span style="background:#22C55E"></span>طبيعي (&lt;' + medThr + ')</span>' +
      '<span class="lv-leg-item"><span style="background:#F59E0B"></span>متوسط (' + medThr + '–' + (highThr-1) + ')</span>' +
      '<span class="lv-leg-item"><span style="background:#EF4444"></span>مرتفع (≥' + highThr + ')</span>' +
    '</div>';

    var yearChart = '<div class="lv-chart">';
    for (var i = 0; i < 12; i++) {
      var d  = _lvYearData[i];
      var hp = d.leaves.length ? Math.max(8, Math.round(d.leaves.length / maxY * 90)) : 3;
      yearChart +=
        '<div class="lv-bar-wrap' + (d.m === curMonth ? ' lv-current' : '') + '"' +
        ' onclick="Dashboard._lvDetail(' + i + ')"' +
        ' title="' + _buildTooltip(d.leaves, d.name) + '">' +
          '<div class="lv-bar" style="height:' + hp + '%;background:' + _barColor(d.leaves.length) + '">' +
            (d.leaves.length ? '<span class="lv-bar-num">' + d.leaves.length + '</span>' : '') +
          '</div>' +
          '<div class="lv-bar-lbl">' + d.name.substring(0,3) + '</div>' +
        '</div>';
    }
    yearChart += '</div><div id="lvd-year-detail"></div>';

    // ---- الشهر الحالي ----
    var cm = _monthLeaves(curYear, curMonth);
    var monthHtml = '<p class="lv-month-title">' + MONTHS[curMonth-1] + ' ' + curYear + ' — ' +
      (cm.length ? cm.length + ' إجازة معتمدة' : 'لا توجد إجازات') + '</p>';
    if (cm.length) {
      var sorted = cm.slice().sort(function(a,b) { return a.startDate < b.startDate ? -1 : 1; });
      monthHtml += '<table class="lv-tbl"><thead><tr><th>الاسم</th><th>المنطقة</th><th>من</th><th>إلى</th><th>أيام</th></tr></thead><tbody>';
      sorted.forEach(function(r) {
        monthHtml += '<tr><td>' + r.name + '</td>' +
          '<td>' + (_lvEmpRegion[String(r.empId)] || '—') + '</td>' +
          '<td>' + CONFIG.fmtDate(r.startDate) + '</td>' +
          '<td>' + CONFIG.fmtDate(r.endDate) + '</td>' +
          '<td style="text-align:center">' + r.days + '</td></tr>';
      });
      monthHtml += '</tbody></table>';
    }

    // ---- 6 أشهر قادمة ----
    var fData = [];
    for (var j = 0; j < 6; j++) {
      var fm = curMonth + j, fy = curYear;
      if (fm > 12) { fm -= 12; fy++; }
      fData.push({ m: fm, y: fy, name: MONTHS[fm-1], leaves: _monthLeaves(fy, fm) });
    }
    var maxF = fData.reduce(function(mx, d2) { return Math.max(mx, d2.leaves.length); }, 0) || 1;
    var futureChart = '<div class="lv-chart">';
    for (var k = 0; k < 6; k++) {
      var fd = fData[k];
      var fh = fd.leaves.length ? Math.max(8, Math.round(fd.leaves.length / maxF * 90)) : 3;
      futureChart +=
        '<div class="lv-bar-wrap' + (fd.m === curMonth && fd.y === curYear ? ' lv-current' : '') + '"' +
        ' title="' + _buildTooltip(fd.leaves, fd.name) + '">' +
          '<div class="lv-bar" style="height:' + fh + '%;background:' + _barColor(fd.leaves.length) + '">' +
            (fd.leaves.length ? '<span class="lv-bar-num">' + fd.leaves.length + '</span>' : '') +
          '</div>' +
          '<div class="lv-bar-lbl">' + fd.name.substring(0,3) +
            (fd.y !== curYear ? '<br><span style="font-size:0.6rem">' + (fd.y-2000) + '</span>' : '') +
          '</div>' +
        '</div>';
    }
    futureChart += '</div>';

    return '<div class="dash-card lv-dist-card">' +
      '<div class="rsc-header"><span class="rsc-icon-wrap">📊</span>' +
        '<span class="rsc-title">توزيع الإجازات — وردية ' + myShift + '</span></div>' +
      '<div class="lv-tabs">' +
        '<button class="lv-tab lv-tab-active" data-lv="year"  onclick="Dashboard._lvTab(\'year\')" >📅 ' + curYear + ' كاملاً</button>' +
        '<button class="lv-tab"              data-lv="month" onclick="Dashboard._lvTab(\'month\')" >📆 ' + MONTHS[curMonth-1] + '</button>' +
        '<button class="lv-tab"              data-lv="future" onclick="Dashboard._lvTab(\'future\')">⏭️ 6 أشهر قادمة</button>' +
      '</div>' +
      '<div id="lvd-year"   class="lv-panel">' + legend + yearChart + '</div>' +
      '<div id="lvd-month"  class="lv-panel" style="display:none">' + monthHtml + '</div>' +
      '<div id="lvd-future" class="lv-panel" style="display:none">' + legend + futureChart + '</div>' +
    '</div>';
  }

  function _lvTab(tab) {
    ['year','month','future'].forEach(function(t) {
      var el = document.getElementById('lvd-' + t);
      if (el) el.style.display = t === tab ? '' : 'none';
    });
    document.querySelectorAll('.lv-tab').forEach(function(btn) {
      var isActive = btn.getAttribute('data-lv') === tab;
      btn.classList.toggle('lv-tab-active', isActive);
      btn.classList.toggle('active', isActive);
    });
  }

  function _lvDetail(idx) {
    var el = document.getElementById('lvd-year-detail');
    if (!el || !_lvYearData) return;
    var d = _lvYearData[idx];
    if (!d) return;
    if (el.dataset.open === String(idx)) { el.innerHTML = ''; el.dataset.open = ''; return; }
    el.dataset.open = String(idx);

    if (!d.leaves.length) {
      el.innerHTML = '<p style="color:#64748B;font-size:0.84rem;padding:6px 4px">لا توجد إجازات في ' + d.name + '</p>';
      return;
    }
    var sorted = d.leaves.slice().sort(function(a,b) { return a.startDate < b.startDate ? -1 : 1; });
    var h = '<div class="lvd-detail-box"><div class="lvd-detail-title">' + d.name + ' — ' + d.leaves.length + ' إجازة</div>' +
      '<table class="lv-tbl"><thead><tr><th>الاسم</th><th>المنطقة</th><th>من</th><th>إلى</th></tr></thead><tbody>';
    sorted.forEach(function(r) {
      h += '<tr><td>' + r.name + '</td>' +
        '<td>' + (_lvEmpRegion[String(r.empId)] || '—') + '</td>' +
        '<td>' + CONFIG.fmtDate(r.startDate) + '</td>' +
        '<td>' + CONFIG.fmtDate(r.endDate) + '</td></tr>';
    });
    h += '</tbody></table></div>';
    el.innerHTML = h;
  }

  function _buildManagerRegionsCard(rgList, role, today, lvReqs, colors, todayShifts, myShift) {
    // للمشرف: فلترة الموظفين حسب وردييته فقط
    var isSup        = role === 'مشرف';
    var filteredList = (isSup && myShift)
      ? rgList.filter(function(r) { return r.shift === myShift; })
      : rgList;

    // الموظفون في إجازة اليوم
    var onLeaveIds = {};
    lvReqs.forEach(function(r) {
      if (r.status === 'معتمد' && r.startDate <= today && r.endDate >= today) {
        onLeaveIds[String(r.empId)] = true;
      }
    });

    // تجميع حسب المنطقة — يُستبعد من ليس له منطقة ومركز
    var assignedList = filteredList.filter(function(r) { return r.region || r.center; });
    var byRegion = {};
    assignedList.forEach(function(r) {
      var reg = r.region || 'غير محدد';
      if (!byRegion[reg]) byRegion[reg] = [];
      byRegion[reg].push(r);
    });

    var regionCount = Object.keys(byRegion).length;
    var centerSet   = {};
    assignedList.forEach(function(r) { if (r.center) centerSet[r.center] = true; });
    var centerCount = Object.keys(centerSet).length;

    // عدد الموظفين في إجازة (من القائمة المفلترة فقط)
    var onLeaveCount = assignedList.filter(function(r) {
      return onLeaveIds[String(r.empId)];
    }).length;
    var presentCount = assignedList.length - onLeaveCount;

    var cardTitle = isSup
      ? 'المناطق والمراكز — وردية ' + myShift
      : 'المناطق والمراكز';
    var presentBox = isSup
      ? '<div class="rsc-box rsc-box-done"><span class="rsc-box-num" style="color:#166534">' + presentCount + '</span><span class="rsc-box-label">متواجد</span></div>'
      : '<div class="rsc-box rsc-box-done"><span class="rsc-box-num">' + assignedList.length + '</span><span class="rsc-box-label">موظف</span></div>';

    var html = '<div class="dash-card regions-card dash-card-wide">' +
      '<div class="rsc-header"><span class="rsc-icon-wrap">🗺️</span><span class="rsc-title">' + cardTitle + '</span></div>' +
      '<div class="rsc-grid rsc-grid-4">' +
        '<div class="rsc-box rsc-box-total"><span class="rsc-box-num">' + regionCount + '</span><span class="rsc-box-label">منطقة</span></div>' +
        '<div class="rsc-box rsc-box-pending"><span class="rsc-box-num">' + centerCount + '</span><span class="rsc-box-label">مركز</span></div>' +
        presentBox +
        '<div class="rsc-box rsc-box-leave"><span class="rsc-box-num">' + onLeaveCount + '</span><span class="rsc-box-label">في إجازة</span></div>' +
      '</div>' +
      '<button class="btn-outline rsc-link-btn" id="btn-show-regions" style="width:100%;margin-top:12px;text-align:center">عرض التفاصيل ▼</button>' +
      '<div id="regions-panel" style="display:none;margin-top:12px">';

    Object.keys(byRegion).forEach(function(reg) {
      var emps = byRegion[reg];
      var regOnLeave  = emps.filter(function(e) { return onLeaveIds[String(e.empId)]; }).length;
      var regPresent  = emps.length - regOnLeave;

      // تجميع حسب المركز
      var byCenters = {};
      emps.forEach(function(e) {
        var c = e.center || 'غير محدد';
        if (!byCenters[c]) byCenters[c] = [];
        byCenters[c].push(e);
      });

      var regionMeta = isSup
        ? regPresent + ' متواجد / ' + emps.length + ' إجمالي' + (regOnLeave ? ' — ' + regOnLeave + ' في إجازة' : '')
        : emps.length + ' موظف';

      html += '<div class="region-section">' +
        '<div class="region-title">📍 ' + reg + ' <span class="rs-count">(' + regionMeta + ')</span></div>';

      Object.keys(byCenters).forEach(function(center) {
        var cEmps     = byCenters[center];
        var cOnLeave  = cEmps.filter(function(e) { return onLeaveIds[String(e.empId)]; }).length;
        var cPresent  = cEmps.length - cOnLeave;

        var centerMeta = isSup
          ? '<span style="color:#166534;font-weight:700">' + cPresent + ' متواجد</span>' +
            ' / ' + cEmps.length + ' إجمالي' +
            (cOnLeave ? ' — <span style="color:#991B1B;font-weight:700">' + cOnLeave + ' إجازة</span>' : '')
          : '';

        html += '<div class="center-section">' +
          '<div class="center-title">🏢 ' + center +
            (centerMeta ? ' <span class="rs-count" style="font-weight:400;font-size:0.82rem"> — ' + centerMeta + '</span>' : '') +
          '</div>' +
          '<div class="regions-table-wrap"><table class="regions-table"><thead><tr>' +
            '<th>الرقم الوظيفي</th><th>الاسم</th>' +
            (isSup ? '' : '<th>الوردية</th>') +
            '<th>المنطقة</th><th>المركز</th><th>السيارة</th><th>الحالة</th>' +
          '</tr></thead><tbody>';

        cEmps.forEach(function(r) {
          var sk   = CONFIG.shiftKey(r.shift||'');
          var sc   = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
          var onL  = onLeaveIds[String(r.empId)];
          var shiftSt  = (todayShifts||{})[sk] || {};
          var stcDuty  = CONFIG.STATUS[shiftSt.en] || CONFIG.STATUS.off;
          var dutyHtml = onL
            ? '<span class="duty-pill" style="background:#FEE2E2;color:#991B1B">🏖️ إجازة</span>'
            : '<span class="duty-pill" style="background:' + stcDuty.bg + ';color:' + stcDuty.text + '">' + stcDuty.icon + ' ' + (shiftSt.ar||'راحة') + '</span>';

          var rowStyle = onL ? ' style="background:#FEF3C7"' : '';
          html += '<tr class="' + (onL ? 'row-on-leave' : '') + '"' + rowStyle + '>' +
            '<td>' + (r.empId||'—')  + '</td>' +
            '<td>' + (r.name||'—')   + '</td>' +
            (isSup ? '' : '<td><span class="shift-badge-sm" style="background:' + sc.color + ';color:#fff">' + (r.shift||'—') + '</span></td>') +
            '<td>' + (r.region||'—') + '</td>' +
            '<td>' + (r.center||'—') + '</td>' +
            '<td>' + (r.car||'—')    + '</td>' +
            '<td>' + dutyHtml        + '</td>' +
          '</tr>';
        });

        html += '</tbody></table></div></div>'; // center-section
      });

      html += '</div>'; // region-section
    });

    if (assignedList.length === 0) {
      html += '<div class="empty-state" style="padding:16px">لا توجد بيانات مناطق</div>';
    }

    html += '</div></div>'; // regions-panel + regions-card
    return html;
  }

  // ---- بطاقة إعدادات الحضور (المشرف) ----
  function _buildPresenceSettingsCard() {
    return '<div class="dash-card presence-settings-card">' +
      '<div class="rsc-header"><span class="rsc-icon-wrap">⚙️</span><span class="rsc-title">إعدادات الحضور</span></div>' +
      '<div class="ps-form">' +
        '<div class="form-field">' +
          '<label>الحد الأدنى لنسبة الحضور في المنطقة (%)</label>' +
          '<input type="number" id="ps-pct" class="form-input" min="10" max="100" step="5" value="60" placeholder="60">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>الحد الأدنى للموظفين في كل مركز</label>' +
          '<input type="number" id="ps-center" class="form-input" min="0" max="10" step="1" value="1" placeholder="1">' +
        '</div>' +
        '<div id="ps-msg" style="font-size:0.82rem;margin-bottom:8px;display:none"></div>' +
        '<button class="btn-primary" style="width:100%" onclick="Dashboard._savePresenceSettings()">💾 حفظ الإعدادات</button>' +
      '</div>' +
    '</div>';
  }

  // ---- مساعدات بطاقة صلاحية الهويات ----
  function _ceMinDays(e) {
    var vals = [];
    if (e.workDaysLeft !== '' && e.workDaysLeft !== null && e.workDaysLeft !== undefined) vals.push(Number(e.workDaysLeft));
    if (e.srcDaysLeft  !== '' && e.srcDaysLeft  !== null && e.srcDaysLeft  !== undefined) vals.push(Number(e.srcDaysLeft));
    return vals.length ? Math.min.apply(null, vals) : null;
  }

  function _ceDaysPill(days) {
    if (days === '' || days === undefined || days === null) return '—';
    var d = Number(days);
    var bg, tx;
    if (d < 10)  { bg = '#FEE2E2'; tx = '#991B1B'; }
    else if (d < 35)  { bg = '#FEF9C3'; tx = '#854D0E'; }
    else if (d <= 90) { bg = '#FFEDD5'; tx = '#9A3412'; }
    else return '<span style="color:var(--text-muted);font-size:0.82rem">' + d + ' يوم</span>';
    return '<span style="background:' + bg + ';color:' + tx + ';padding:2px 8px;border-radius:50px;font-size:0.82rem;font-weight:700">' + d + ' يوم</span>';
  }

  function _buildCardExpiryCard(empList, role, myShift) {
    var isSup = role === 'مشرف';
    // فلترة من لديهم تاريخ بطاقة واحدة على الأقل
    var list = empList.filter(function(e) { return e.workExpDate || e.srcExpDate; });

    // الإحصاء حسب الفئات
    var red = 0, yellow = 0, orange = 0;
    list.forEach(function(e) {
      var d = _ceMinDays(e);
      if (d === null) return;
      if (d < 10)  red++;
      else if (d < 35)  yellow++;
      else if (d <= 90) orange++;
    });

    // ترتيب: الأقرب للانتهاء أولاً
    list.sort(function(a, b) {
      var da = _ceMinDays(a), db = _ceMinDays(b);
      if (da === null) return 1; if (db === null) return -1;
      return da - db;
    });

    var cardTitle = isSup ? 'صلاحية البطاقات — وردية ' + myShift : 'صلاحية البطاقات';

    var html = '<div class="dash-card dash-card-wide ce-card">' +
      '<div class="rsc-header"><span class="rsc-icon-wrap">🪪</span><span class="rsc-title">' + cardTitle + '</span></div>';

    // ملخص ملون
    html += '<div class="ce-summary">';
    if (red)    html += '<div class="ce-badge ce-badge-red"><span class="ce-badge-num">' + red + '</span><span class="ce-badge-lbl">أقل من 10 أيام</span></div>';
    if (yellow) html += '<div class="ce-badge ce-badge-yellow"><span class="ce-badge-num">' + yellow + '</span><span class="ce-badge-lbl">10 — 34 يوم</span></div>';
    if (orange) html += '<div class="ce-badge ce-badge-orange"><span class="ce-badge-num">' + orange + '</span><span class="ce-badge-lbl">35 — 90 يوم</span></div>';
    if (!red && !yellow && !orange) html += '<div class="ce-badge ce-badge-ok">✅ جميع البطاقات سارية (أكثر من 90 يوم)</div>';
    html += '</div>';

    if (list.length === 0) {
      html += '<div class="empty-state" style="padding:16px">لا توجد بيانات بطاقات</div></div>';
      return html;
    }

    // زر إظهار/إخفاء الجدول
    html += '<button class="btn-outline rsc-link-btn" id="btn-show-ce" style="width:100%;margin-top:12px;text-align:center">عرض تفاصيل البطاقات ▼</button>' +
      '<div id="ce-panel" style="display:none;margin-top:12px">';

    if (!isSup) {
      // المدير: مجموعة لكل وردية
      ['أ','ب','ج','د'].forEach(function(shiftLabel) {
        var sk  = CONFIG.shiftKey(shiftLabel);
        var sc  = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
        var grp = list.filter(function(e) { return e.shift === shiftLabel; });
        if (!grp.length) return;
        html += '<div class="ce-group">' +
          '<div class="ce-group-header" style="background:' + sc.color + '">' +
            '<span>وردية ' + shiftLabel + '</span>' +
            '<span class="ce-group-count">' + grp.length + ' موظف</span>' +
          '</div>' +
          _buildCeTable(grp, false) +
          '</div>';
      });
    } else {
      html += _buildCeTable(list, true);
    }

    html += '</div></div>'; // ce-panel + ce-card
    return html;
  }

  function _buildCeTable(emps, hideSft) {
    var html = '<div class="regions-table-wrap"><table class="regions-table"><thead><tr>' +
      '<th>الرقم الوظيفي</th><th>الاسم</th>' +
      (hideSft ? '' : '<th>الوردية</th>') +
      '<th>بطاقة العمل</th><th>المتبقي</th>' +
      '<th>بطاقة مصدر/مستلم</th><th>المتبقي</th>' +
    '</tr></thead><tbody>';

    emps.forEach(function(e) {
      var d = _ceMinDays(e);
      var rowBg = '';
      if (d !== null) {
        if (d < 10)  rowBg = ' style="background:#FEE2E2"';
        else if (d < 35)  rowBg = ' style="background:#FEF9C3"';
        else if (d <= 90) rowBg = ' style="background:#FFEDD5"';
      }
      var sk = CONFIG.shiftKey(e.shift||'');
      var sc = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
      html += '<tr' + rowBg + '>' +
        '<td>' + (e.empId||'—') + '</td>' +
        '<td>' + (e.name||'—')  + '</td>' +
        (hideSft ? '' : '<td><span class="shift-badge-sm" style="background:' + sc.color + ';color:#fff">' + (e.shift||'—') + '</span></td>') +
        '<td>' + (e.workExpDate||'—') + '</td>' +
        '<td>' + _ceDaysPill(e.workDaysLeft) + '</td>' +
        '<td>' + (e.srcExpDate||'—')  + '</td>' +
        '<td>' + _ceDaysPill(e.srcDaysLeft)  + '</td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';
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

      var presentBadge = (d.present != null && d.present > 0)
        ? '<div class="api-present-stat"><span class="api-present-icon">👷</span><span>' + d.present + ' موظف في الخدمة الآن</span></div>'
        : '';
      var html = '<h3 class="dash-card-title">📊 بطاقة الاستهلاك — طلبات API اليومية (الحد الأقصى ' + limit.toLocaleString() + ')</h3>' + presentBadge;
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

  function quickComprehensive(format) {
    // يستخدم مباشرة _getComprehensiveData من Export لضمان توحيد منطق البيانات
    var role    = Auth.getEffectiveRole();
    var isSup   = role === 'مشرف';
    var shift   = isSup ? (Auth.getShift ? Auth.getShift() : '') : '';
    Export.getComprehensiveData(shift, '', '', function(compData) {
      Export.exportDirect(compData, format);
    });
  }

  function _savePresenceSettings() {
    var pct    = parseInt(document.getElementById('ps-pct')   && document.getElementById('ps-pct').value)   || 60;
    var center = parseInt(document.getElementById('ps-center') && document.getElementById('ps-center').value) || 1;
    var msgEl  = document.getElementById('ps-msg');
    if (pct < 10 || pct > 100) {
      if (msgEl) { msgEl.textContent = '⚠️ النسبة يجب أن تكون بين 10% و100%'; msgEl.style.color = 'red'; msgEl.style.display = 'block'; }
      return;
    }
    API.updateSettings({ region_min_presence_pct: String(pct), region_min_per_center: String(center) }).then(function(res) {
      if (msgEl) {
        msgEl.textContent  = res.ok ? '✅ تم الحفظ' : '❌ خطأ: ' + res.error;
        msgEl.style.color  = res.ok ? 'green' : 'red';
        msgEl.style.display = 'block';
        setTimeout(function() { if (msgEl) msgEl.style.display = 'none'; }, 3000);
      }
    });
  }

  // تحميل الإعدادات الحالية في البطاقة
  function _loadPresenceDefaults() {
    API.getSettings && API.getSettings().then(function(res) {
      if (!res || !res.ok) return;
      var pctEl    = document.getElementById('ps-pct');
      var centerEl = document.getElementById('ps-center');
      if (pctEl    && res.data.region_min_presence_pct) pctEl.value    = res.data.region_min_presence_pct;
      if (centerEl && res.data.region_min_per_center)   centerEl.value = res.data.region_min_per_center;
    }).catch(function(){});
  }

  return { render: render, quickComprehensive: quickComprehensive,
           _savePresenceSettings: _savePresenceSettings,
           _lvTab: _lvTab, _lvDetail: _lvDetail };
})();
