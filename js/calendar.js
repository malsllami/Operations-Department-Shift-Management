// ============================================================
// تقويم الورديات الشبكي
// ============================================================

var Calendar = (function () {

  var _year  = new Date().getFullYear();
  var _month = new Date().getMonth() + 1;
  var _scheduleData = null;

  function init(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    _year  = new Date().getFullYear();
    _month = new Date().getMonth() + 1;
    _render(el);
  }

  function _render(el) {
    el.innerHTML = '<div class="cal-loading"><div class="spinner"></div><p>جارٍ تحميل التقويم...</p></div>';

    API.getSchedule(_year, _month).then(function(res) {
      if (!res.ok) {
        el.innerHTML = '<div class="empty-state">تعذّر تحميل التقويم</div>';
        return;
      }
      _scheduleData = res;
      el.innerHTML = _buildCalendar(res);
      _bindNav(el);
      _scrollToToday();
    });
  }

  function _buildCalendar(res) {
    var schedule = res.schedule;
    var summary  = res.summary;
    var colors   = res.colors;
    var today    = CONFIG.todayStr();

    var html = '';

    // ---- رأس التقويم ----
    html += '<div class="cal-header">' +
      '<button class="cal-nav-btn" id="cal-prev">&#8250;</button>' +
      '<div class="cal-title">' +
        '<span class="cal-month">' + CONFIG.MONTHS_AR[_month-1] + ' ' + _year + '</span>' +
        '<button class="cal-today-btn" id="cal-today-btn">اليوم</button>' +
      '</div>' +
      '<button class="cal-nav-btn" id="cal-next">&#8249;</button>' +
    '</div>';

    // ---- أعمدة الورديات ----
    html += '<div class="cal-grid-wrapper"><div class="cal-grid">';

    // رأس الشبكة
    html += '<div class="cal-col cal-col-date">' +
      '<div class="cal-col-header">التاريخ</div>';
    schedule.forEach(function(day) {
      var isToday = day.date === today;
      var hDate   = Hijri.fromDate(new Date(day.date));
      html += '<div class="cal-cell cal-cell-date' + (isToday ? ' cal-today-row' : '') + '">' +
        '<div class="cal-day-num' + (isToday ? ' today-badge' : '') + '">' +
          CONFIG.DAYS_AR[day.dow] +
          '<br><span class="cal-day-main">' + parseInt(day.date.split('-')[2]) + '</span>' +
          '<br><small class="cal-hijri">' + hDate.day + '/' + hDate.month + '</small>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';

    // عمود لكل وردية
    ['a','b','c','d'].forEach(function(sk) {
      var label  = CONFIG.SHIFTS[sk].label;
      var color  = colors[sk] || CONFIG.SHIFTS[sk].color;
      var statusKey = sk;
      html += '<div class="cal-col">';
      html += '<div class="cal-col-header" style="background:' + color + ';color:#fff">وردية ' + label + '</div>';
      schedule.forEach(function(day) {
        var status = day[sk];
        var st     = CONFIG.STATUS[status] || CONFIG.STATUS.off;
        var isToday= day.date === today;
        html += '<div class="cal-cell' + (isToday ? ' cal-today-row' : '') + '" style="background:' + st.bg + '">' +
          '<span class="cal-status-badge" style="color:' + st.text + '">' +
            st.icon + ' ' + st.label +
          '</span>' +
        '</div>';
      });
      html += '</div>';
    });

    html += '</div></div>';

    // ---- جدول ملخص الشهر ----
    html += '<div class="cal-summary">';
    html += '<h3 class="cal-summary-title">ملخص شهر ' + CONFIG.MONTHS_AR[_month-1] + '</h3>';
    html += '<table class="cal-summary-table"><thead><tr>' +
      '<th>الوردية</th><th>☀ صباح</th><th>🌙 مساء</th><th>🏠 راحة</th><th>إجمالي دوام</th>' +
    '</tr></thead><tbody>';

    ['a','b','c','d'].forEach(function(sk) {
      var label = 'وردية ' + CONFIG.SHIFTS[sk].label;
      var color = colors[sk] || CONFIG.SHIFTS[sk].color;
      var s     = summary[sk] || {};
      html += '<tr>' +
        '<td><span class="shift-dot" style="background:' + color + '"></span>' + label + '</td>' +
        '<td>' + (s.morning||0) + '</td>' +
        '<td>' + (s.evening||0) + '</td>' +
        '<td>' + (s.off||0)     + '</td>' +
        '<td><strong>' + ((s.morning||0) + (s.evening||0)) + '</strong></td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function _bindNav(el) {
    var prevBtn = el.querySelector('#cal-prev');
    var nextBtn = el.querySelector('#cal-next');
    var todBtn  = el.querySelector('#cal-today-btn');

    if (prevBtn) prevBtn.onclick = function() {
      _month--;
      if (_month < 1) { _month = 12; _year--; }
      _render(el);
    };
    if (nextBtn) nextBtn.onclick = function() {
      _month++;
      if (_month > 12) { _month = 1; _year++; }
      _render(el);
    };
    if (todBtn) todBtn.onclick = function() {
      var now = new Date();
      _year  = now.getFullYear();
      _month = now.getMonth() + 1;
      _render(el);
    };
  }

  function _scrollToToday() {
    setTimeout(function() {
      var todayRow = document.querySelector('.cal-today-row');
      if (todayRow) todayRow.scrollIntoView({ behavior:'smooth', block:'center' });
    }, 200);
  }

  // تقويم مصغر لنموذج الإجازة
  function renderMini(containerId, startDate, endDate, shift) {
    var el = document.getElementById(containerId);
    if (!el || !startDate || !endDate) { if(el) el.innerHTML=''; return; }

    var start = new Date(startDate);
    var end   = new Date(endDate);
    if (isNaN(start) || isNaN(end) || start > end) { el.innerHTML=''; return; }

    var html = '<div class="mini-cal-title">حالة الوردية خلال فترة الإجازة</div>';
    html += '<div class="mini-cal-grid">';

    var d = new Date(start);
    while (d <= end) {
      var ds  = CONFIG.todayStr.call({ d:d },
        [d.getFullYear(), CONFIG._p(d.getMonth()+1), CONFIG._p(d.getDate())].join('-'));
      ds = d.getFullYear() + '-' + CONFIG._p(d.getMonth()+1) + '-' + CONFIG._p(d.getDate());
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
