// ============================================================
// تقويم الورديات — شبكة شهرية حقيقية
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
    _el.innerHTML = '<div class="cal-loading"><div class="spinner"></div></div>';

    API.getSchedule(_year, _month).then(function(res) {
      if (!res.ok) { _el.innerHTML = '<div class="empty-state">تعذّر تحميل التقويم</div>'; return; }
      _el.innerHTML = _buildGrid(res);
      _bindNav();
      _scrollToday();
    });
  }

  // ============================================================
  // بناء الشبكة الشهرية
  // ============================================================
  function _buildGrid(res) {
    var schedule = res.schedule;
    var summary  = res.summary;
    var colors   = res.colors;
    var today    = CONFIG.todayStr();

    // بناء خريطة date → بيانات اليوم
    var dayMap = {};
    schedule.forEach(function(d) { dayMap[d.date] = d; });

    // أول وآخر يوم في الشهر
    var firstDay = new Date(_year, _month - 1, 1);
    var lastDay  = new Date(_year, _month, 0);
    var totalDays = lastDay.getDate();
    // يوم الأسبوع لأول يوم (0=أحد)
    var startDow = firstDay.getDay();

    var html = '';

    // ---- شريط التنقل ----
    html += '<div class="cal-nav-bar">' +
      '<button class="cal-nav-btn" id="cal-prev">&#8250;</button>' +
      '<div class="cal-nav-center">' +
        '<span class="cal-month-title">' + CONFIG.MONTHS_AR[_month-1] + ' ' + _year + '</span>' +
        '<button class="cal-today-btn" id="cal-today-btn">اليوم</button>' +
      '</div>' +
      '<button class="cal-nav-btn" id="cal-next">&#8249;</button>' +
    '</div>';

    // ---- الشبكة ----
    html += '<div class="cal-month-grid">';

    // رأس أيام الأسبوع
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

      html += '<div class="cal-day-cell' + (isToday ? ' cal-today' : '') + '"' +
              (isToday ? ' id="cal-today-cell"' : '') + '>';

      // رقم اليوم والهجري
      html += '<div class="cal-day-header">' +
        '<span class="cal-day-num' + (isToday ? ' cal-today-num' : '') + '">' + d2 + '</span>' +
        '<span class="cal-day-hijri">' + hDate.day + ' ' + CONFIG.HIJRI_MONTHS[hDate.month-1].substring(0,3) + '</span>' +
      '</div>';

      // شارات الورديات الأربع
      html += '<div class="cal-day-shifts">';
      ['a','b','c','d'].forEach(function(sk) {
        var status = dayData[sk] || 'off';
        var st     = CONFIG.STATUS[status] || CONFIG.STATUS.off;
        var color  = colors[sk] || CONFIG.SHIFTS[sk].color;
        var lbl    = CONFIG.SHIFTS[sk].label;
        html += '<div class="cal-shift-pill" style="background:' + st.bg + ';color:' + st.text + ';border-color:' + color + '">' +
          '<span class="csp-letter" style="background:' + color + '">' + lbl + '</span>' +
          '<span class="csp-icon">' + st.icon + '</span>' +
          '<span class="csp-txt">' + st.label + '</span>' +
        '</div>';
      });
      html += '</div>'; // cal-day-shifts

      html += '</div>'; // cal-day-cell
    }

    // خلايا فارغة بعد آخر يوم لإكمال الأسبوع
    var remaining = (7 - (startDow + totalDays) % 7) % 7;
    for (var r = 0; r < remaining; r++) {
      html += '<div class="cal-day-cell cal-day-empty"></div>';
    }

    html += '</div>'; // cal-month-grid

    // ---- بطاقات الملخص (بدل الجدول) ----
    html += '<div class="cal-summary-cards">';
    ['a','b','c','d'].forEach(function(sk) {
      var s     = summary[sk] || {};
      var color = colors[sk] || CONFIG.SHIFTS[sk].color;
      var label = 'وردية ' + CONFIG.SHIFTS[sk].label;
      var total = (s.morning||0) + (s.evening||0);
      html += '<div class="cal-sum-card" style="border-top:4px solid ' + color + '">' +
        '<div class="csc-title" style="color:' + color + '">' + label + '</div>' +
        '<div class="csc-rows">' +
          '<div class="csc-row"><span class="csc-icon">☀</span><span class="csc-label">صباح</span><span class="csc-val">' + (s.morning||0) + '</span></div>' +
          '<div class="csc-row"><span class="csc-icon">🌙</span><span class="csc-label">مساء</span><span class="csc-val">' + (s.evening||0) + '</span></div>' +
          '<div class="csc-row"><span class="csc-icon">🏠</span><span class="csc-label">راحة</span><span class="csc-val">' + (s.off||0) + '</span></div>' +
        '</div>' +
        '<div class="csc-total" style="color:' + color + '">' +
          '<span>إجمالي دوام</span><span>' + total + ' يوم</span>' +
        '</div>' +
      '</div>';
    });
    html += '</div>'; // cal-summary-cards

    return html;
  }

  function _bindNav() {
    var prev = _el.querySelector('#cal-prev');
    var next = _el.querySelector('#cal-next');
    var tod  = _el.querySelector('#cal-today-btn');
    if (prev) prev.onclick = function() { _month--; if (_month<1){_month=12;_year--;} _render(); };
    if (next) next.onclick = function() { _month++; if (_month>12){_month=1;_year++;} _render(); };
    if (tod)  tod.onclick  = function() { var n=new Date(); _year=n.getFullYear(); _month=n.getMonth()+1; _render(); };
  }

  function _scrollToday() {
    setTimeout(function() {
      var cell = document.getElementById('cal-today-cell');
      if (cell) cell.scrollIntoView({ behavior:'smooth', block:'center' });
    }, 150);
  }

  // ============================================================
  // تقويم مصغر لنموذج الإجازة
  // ============================================================
  function renderMini(containerId, startDate, endDate, shift) {
    var el = document.getElementById(containerId);
    if (!el || !startDate || !endDate) { if (el) el.innerHTML = ''; return; }
    var start = new Date(startDate);
    var end   = new Date(endDate);
    if (isNaN(start) || isNaN(end) || start > end) { el.innerHTML = ''; return; }

    var html = '<div class="mini-cal-title">حالة الوردية خلال فترة الإجازة</div>';
    html += '<div class="mini-cal-grid">';
    var d = new Date(start);
    while (d <= end) {
      var ds  = d.getFullYear() + '-' + CONFIG._p(d.getMonth()+1) + '-' + CONFIG._p(d.getDate());
      var st  = CONFIG.getShiftStatus(shift, ds);
      var stc = CONFIG.STATUS[st.en] || CONFIG.STATUS.off;
      html += '<div class="mini-cal-day" style="background:' + stc.bg + ';color:' + stc.text + '">' +
        '<div class="mcd-date">' + d.getDate() + '</div>' +
        '<div class="mcd-status">' + stc.icon + '</div>' +
        '<div class="mcd-label">' + stc.label + '</div>' +
      '</div>';
      d.setDate(d.getDate() + 1);
    }
    html += '</div>';
    el.innerHTML = html;
  }

  return { init: init, renderMini: renderMini };
})();
