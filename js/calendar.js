// ============================================================
// تقويم الورديات — تصميم محسّن
// ============================================================

var Calendar = (function () {

  var _year  = new Date().getFullYear();
  var _month = new Date().getMonth() + 1;
  var _el    = null;

  function init(containerId) {
    _el = document.getElementById(containerId);
    if (!_el) return;
    _year  = new Date().getFullYear();
    _month = new Date().getMonth() + 1;
    _render();
  }

  function _render() {
    if (!_el) return;
    _el.innerHTML = '<div class="cal-loading"><div class="spinner"></div><p>جارٍ تحميل التقويم…</p></div>';
    API.getSchedule(_year, _month).then(function(res) {
      if (!res.ok) { _el.innerHTML = '<div class="empty-state">تعذّر تحميل التقويم</div>'; return; }
      _el.innerHTML = _build(res);
      _bindNav();
      _scrollToday();
    });
  }

  // ============================================================
  // بناء التقويم
  // ============================================================
  function _build(res) {
    var schedule  = res.schedule;
    var summary   = res.summary;
    var colors    = res.colors;
    var today     = CONFIG.todayStr();

    var dayMap = {};
    schedule.forEach(function(d) { dayMap[d.date] = d; });

    var firstDay  = new Date(_year, _month - 1, 1);
    var lastDay   = new Date(_year, _month, 0);
    var totalDays = lastDay.getDate();
    var startDow  = firstDay.getDay();

    var html = '';

    // ---- رأس التنقل ----
    var hMid = Hijri.fromDate(new Date(_year, _month - 1, 15));
    var hijriLabel = CONFIG.HIJRI_MONTHS[hMid.month - 1] + ' ' + hMid.year + ' هـ';
    html += '<div class="cal-nav-bar">' +
      '<button class="cal-nav-btn" id="cal-prev">&#10094;</button>' +
      '<div class="cal-nav-center">' +
        '<div class="cal-title-wrap">' +
          '<h2 class="cal-month-title">' + CONFIG.MONTHS_AR[_month-1] + ' ' + _year + '</h2>' +
          '<span class="cal-title-hijri">' + hijriLabel + '</span>' +
        '</div>' +
        '<button class="cal-today-btn" id="cal-today-btn">اليوم</button>' +
      '</div>' +
      '<button class="cal-nav-btn" id="cal-next">&#10095;</button>' +
    '</div>';

    // ---- مفتاح الألوان (Legend) ----
    html += '<div class="cal-legend">';
    ['a','b','c','d'].forEach(function(sk) {
      var color = colors[sk] || CONFIG.SHIFTS[sk].color;
      html += '<span class="cal-leg-item">' +
        '<span class="cal-leg-dot" style="background:' + color + '"></span>' +
        'وردية ' + CONFIG.SHIFTS[sk].label + '</span>';
    });
    html += '<span class="cal-leg-item"><span class="cal-leg-icon">☀</span>صباح</span>' +
            '<span class="cal-leg-item"><span class="cal-leg-icon">🌙</span>مساء</span>' +
            '<span class="cal-leg-item"><span class="cal-leg-icon">🏠</span>راحة</span>';
    html += '</div>';

    // ---- الشبكة (قابلة للتمرير أفقياً على الجوال) ----
    html += '<div class="cal-scroll-wrap"><div class="cal-month-grid">';

    // أيام الأسبوع
    ['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'].forEach(function(d) {
      html += '<div class="cal-weekday">' + d + '</div>';
    });

    // خلايا فارغة قبل أول يوم
    for (var e = 0; e < startDow; e++) {
      html += '<div class="cal-day-cell cal-day-empty"></div>';
    }

    // أيام الشهر
    for (var d2 = 1; d2 <= totalDays; d2++) {
      var ds      = _year + '-' + CONFIG._p(_month) + '-' + CONFIG._p(d2);
      var dayData = dayMap[ds] || {};
      var isToday = ds === today;
      var hDate   = Hijri.fromDate(new Date(ds));
      var dowIdx  = (startDow + d2 - 1) % 7;
      var isWeekend = dowIdx === 5 || dowIdx === 6; // جمعة وسبت

      html += '<div class="cal-day-cell' +
        (isToday    ? ' cal-today'   : '') +
        (isWeekend  ? ' cal-weekend' : '') + '"' +
        (isToday    ? ' id="cal-today-cell"' : '') + '>';

      // رقم اليوم الميلادي + الهجري أسفله
      html += '<div class="cal-day-top">' +
        '<div class="cal-day-num' + (isToday ? ' cal-today-num' : '') + '">' + d2 + '</div>' +
        '<div class="cal-day-hijri">' + hDate.day + ' ' + CONFIG.HIJRI_MONTHS[hDate.month-1].substring(0,3) + '</div>' +
      '</div>';

      // أعمدة الورديات الأربع
      html += '<div class="cal-day-body">';
      ['a','b','c','d'].forEach(function(sk) {
        var status = dayData[sk] || 'off';
        var stc    = CONFIG.STATUS[status] || CONFIG.STATUS.off;
        var color  = colors[sk] || CONFIG.SHIFTS[sk].color;
        html += '<div class="cal-shift-row" style="background:' + stc.bg + ';color:' + stc.text + '">' +
          '<span class="csr-letter" style="background:' + color + '">' + CONFIG.SHIFTS[sk].label + '</span>' +
          '<span class="csr-icon">' + stc.icon + '</span>' +
          '<span class="csr-label">' + stc.label + '</span>' +
        '</div>';
      });
      html += '</div>'; // cal-day-body

      html += '</div>'; // cal-day-cell
    }

    // خلايا لإتمام الأسبوع الأخير
    var filled = startDow + totalDays;
    var remaining = filled % 7 === 0 ? 0 : 7 - (filled % 7);
    for (var r = 0; r < remaining; r++) {
      html += '<div class="cal-day-cell cal-day-empty"></div>';
    }

    html += '</div></div>'; // cal-month-grid + cal-scroll-wrap

    // ---- بطاقات الملخص ----
    html += '<div class="cal-summary-cards">';
    ['a','b','c','d'].forEach(function(sk) {
      var s     = summary[sk] || {};
      var color = colors[sk] || CONFIG.SHIFTS[sk].color;
      var total = (s.morning||0) + (s.evening||0);
      html += '<div class="cal-sum-card" style="border-top: 4px solid ' + color + '">' +
        '<div class="csc-title" style="color:' + color + '">وردية ' + CONFIG.SHIFTS[sk].label + '</div>' +
        '<div class="csc-rows">' +
          '<div class="csc-row"><span class="csc-icon">☀</span><span class="csc-lbl">صباح</span><span class="csc-val">' + (s.morning||0) + '</span></div>' +
          '<div class="csc-row"><span class="csc-icon">🌙</span><span class="csc-lbl">مساء</span><span class="csc-val">' + (s.evening||0) + '</span></div>' +
          '<div class="csc-row"><span class="csc-icon">🏠</span><span class="csc-lbl">راحة</span><span class="csc-val">' + (s.off||0) + '</span></div>' +
        '</div>' +
        '<div class="csc-total" style="color:' + color + '">' + total + ' يوم دوام</div>' +
      '</div>';
    });
    html += '</div>';

    return html;
  }

  function _bindNav() {
    var prev = _el.querySelector('#cal-prev');
    var next = _el.querySelector('#cal-next');
    var tod  = _el.querySelector('#cal-today-btn');
    if (prev) prev.onclick = function() { _month--; if(_month<1){_month=12;_year--;} _render(); };
    if (next) next.onclick = function() { _month++; if(_month>12){_month=1;_year++;} _render(); };
    if (tod)  tod.onclick  = function() { var n=new Date(); _year=n.getFullYear(); _month=n.getMonth()+1; _render(); };
  }

  function _scrollToday() {
    setTimeout(function() {
      var cell = document.getElementById('cal-today-cell');
      if (cell) cell.scrollIntoView({ behavior:'smooth', block:'center' });
    }, 200);
  }

  // ============================================================
  // التقويم المصغر لنموذج الإجازة — تصميم محسّن
  // ============================================================
  function renderMini(containerId, startDate, endDate, shift) {
    var el = document.getElementById(containerId);
    if (!el) { return; }
    if (!startDate || !endDate) { el.innerHTML = ''; return; }

    var start = new Date(startDate);
    var end   = new Date(endDate);
    if (isNaN(start) || isNaN(end) || start > end) { el.innerHTML = ''; return; }

    var days  = [];
    var d     = new Date(start);
    while (d <= end) {
      var ds  = d.getFullYear() + '-' + CONFIG._p(d.getMonth()+1) + '-' + CONFIG._p(d.getDate());
      var st  = CONFIG.getShiftStatus(shift, ds);
      var stc = CONFIG.STATUS[st.en] || CONFIG.STATUS.off;
      days.push({ num: d.getDate(), dow: d.getDay(), stc: stc, ds: ds });
      d.setDate(d.getDate() + 1);
    }

    // تقسيم إلى أسابيع
    var weeks = [];
    var week  = [];
    // ابدأ بإدراج أيام فارغة قبل أول يوم
    var firstDow = days[0].dow;
    for (var i = 0; i < firstDow; i++) week.push(null);
    days.forEach(function(day) {
      week.push(day);
      if (week.length === 7) { weeks.push(week); week = []; }
    });
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    var html = '<div class="mini-cal-wrap">' +
      '<div class="mini-cal-title">📅 حالة الوردية خلال فترة الإجازة</div>';

    // رأس أيام الأسبوع
    html += '<div class="mini-cal-table">';
    html += '<div class="mini-cal-head">';
    ['أ','ث','ث','أ','خ','ج','س'].forEach(function(d) {
      html += '<div class="mini-head-cell">' + d + '</div>';
    });
    html += '</div>';

    // صفوف الأسابيع
    weeks.forEach(function(wk) {
      html += '<div class="mini-cal-row">';
      wk.forEach(function(day) {
        if (!day) {
          html += '<div class="mini-day-cell mini-day-empty"></div>';
        } else {
          var hd = Hijri.fromDate(new Date(day.ds));
          var hijriTxt = hd.day + ' ' + CONFIG.HIJRI_MONTHS[hd.month - 1].substring(0, 3);
          html += '<div class="mini-day-cell" style="background:' + day.stc.bg + ';color:' + day.stc.text + ';border-color:' + day.stc.badge + '">' +
            '<span class="mdc-num">' + day.num + '</span>' +
            '<span class="mdc-hijri">' + hijriTxt + '</span>' +
            '<span class="mdc-icon">' + day.stc.icon + '</span>' +
            '<span class="mdc-lbl">' + day.stc.label + '</span>' +
          '</div>';
        }
      });
      html += '</div>';
    });

    html += '</div></div>'; // mini-cal-table + mini-cal-wrap
    el.innerHTML = html;
  }

  return { init: init, renderMini: renderMini };
})();
