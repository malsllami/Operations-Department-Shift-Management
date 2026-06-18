// ============================================================
// التقويم — كل يوم بطاقة مستقلة (هجري + ميلادي + حالة الورديات)
// ============================================================

var Calendar = (function () {

  var _currentYear   = new Date().getFullYear();
  var _currentMonth  = new Date().getMonth() + 1;
  var _scheduleData  = null;
  var _selectedShift = 'all';
  var _containerId   = null;

  function init(containerId) {
    _containerId = containerId;
    _renderShell(containerId);
    _load(containerId);
  }

  // ---- Shell (navigation + filters) ----

  function _renderShell(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML =
      '<div class="calendar-wrapper">' +
        '<div class="calendar-header">' +
          '<button class="btn-icon" id="cal-prev">&#8249;</button>' +
          '<span class="calendar-title" id="cal-month-year"></span>' +
          '<button class="btn-icon" id="cal-next">&#8250;</button>' +
        '</div>' +
        '<div class="shift-filter" id="shift-filter">' +
          '<button class="shift-btn active" data-shift="all">الكل</button>' +
          '<button class="shift-btn shift-a" data-shift="a">وردية أ</button>' +
          '<button class="shift-btn shift-b" data-shift="b">وردية ب</button>' +
          '<button class="shift-btn shift-c" data-shift="c">وردية ج</button>' +
          '<button class="shift-btn shift-d" data-shift="d">وردية د</button>' +
        '</div>' +
        '<div class="calendar-day-headers">' +
          CONFIG.DAYS_AR.map(function(d) {
            return '<div class="day-header">' + d + '</div>';
          }).join('') +
        '</div>' +
        '<div class="calendar-grid" id="calendar-grid">' +
          '<div class="cal-loading"><div class="spinner"></div><span>جارٍ التحميل...</span></div>' +
        '</div>' +
        '<div class="calendar-summary" id="calendar-summary"></div>' +
      '</div>';

    document.getElementById('cal-prev').onclick = function() {
      _currentMonth--;
      if (_currentMonth < 1) { _currentMonth = 12; _currentYear--; }
      _load(containerId);
    };
    document.getElementById('cal-next').onclick = function() {
      _currentMonth++;
      if (_currentMonth > 12) { _currentMonth = 1; _currentYear++; }
      _load(containerId);
    };

    el.querySelectorAll('.shift-btn').forEach(function(btn) {
      btn.onclick = function() {
        _selectedShift = this.dataset.shift;
        el.querySelectorAll('.shift-btn').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        if (_scheduleData) _renderDays(_scheduleData);
      };
    });
  }

  // ---- Load from API ----

  function _load(containerId) {
    var grid = document.getElementById('calendar-grid');
    if (grid) grid.innerHTML = '<div class="cal-loading"><div class="spinner"></div><span>جارٍ التحميل...</span></div>';

    var titleEl = document.getElementById('cal-month-year');
    if (titleEl) titleEl.textContent = CONFIG.MONTHS_AR[_currentMonth - 1] + ' ' + _currentYear;

    API.getSchedule(_currentYear, _currentMonth).then(function(res) {
      if (!res.ok) {
        if (grid) grid.innerHTML = '<div class="cal-error">تعذر تحميل البيانات — تحقق من الاتصال</div>';
        return;
      }
      _scheduleData = res;
      _renderDays(res);
    });
  }

  // ---- Render day cards ----

  function _renderDays(res) {
    var grid = document.getElementById('calendar-grid');
    if (!grid) return;

    var schedule = res.schedule;
    var colors   = res.colors || {};

    var today    = new Date();
    var todayStr = today.getFullYear() + '-' + _pad(today.getMonth() + 1) + '-' + _pad(today.getDate());

    // First day-of-week offset (0=Sun)
    var firstDow = new Date(_currentYear, _currentMonth - 1, 1).getDay();
    var html = '';

    // Empty cells before first day
    for (var e = 0; e < firstDow; e++) {
      html += '<div class="cal-cell cal-empty"></div>';
    }

    schedule.forEach(function(day) {
      var date    = new Date(day.date);
      var hijri   = Hijri.fromDate(date);
      var isToday = day.date === todayStr;
      var dayNum  = parseInt(day.date.split('-')[2]);

      html += '<div class="cal-card' + (isToday ? ' cal-today' : '') + '">' +
        // ---- Header: day name + number ----
        '<div class="cal-card-head">' +
          '<span class="cal-day-name">' + CONFIG.DAYS_AR[date.getDay()] + '</span>' +
          '<span class="cal-day-num' + (isToday ? ' today-num' : '') + '">' + dayNum + '</span>' +
        '</div>' +
        // ---- Hijri date ----
        '<div class="cal-hijri-date">' +
          hijri.day + ' ' + CONFIG.HIJRI_MONTHS[hijri.month - 1] +
        '</div>' +
        // ---- Shift rows ----
        '<div class="cal-shifts-rows">' + _buildShiftRows(day, colors) + '</div>' +
      '</div>';
    });

    grid.innerHTML = html;
    _renderSummary(res.summary, colors);
  }

  function _buildShiftRows(day, colors) {
    var entries = [
      { key: 'a', en: day.a },
      { key: 'b', en: day.b },
      { key: 'c', en: day.c },
      { key: 'd', en: day.d }
    ];
    var html = '';
    entries.forEach(function(s) {
      if (_selectedShift !== 'all' && _selectedShift !== s.key) return;
      var sc    = CONFIG.STATUS[s.en] || CONFIG.STATUS.off;
      var shift = CONFIG.SHIFTS[s.key] || {};
      var color = colors[s.key] || shift.solid || '#999';
      html += '<div class="cal-shift-pill">' +
        '<span class="csp-label" style="background:' + color + '">' +
          (shift.label || s.key) +
        '</span>' +
        '<span class="csp-status" style="background:' + sc.bg + ';color:' + sc.text + '">' +
          sc.icon + ' ' + sc.label +
        '</span>' +
      '</div>';
    });
    return html;
  }

  // ---- Summary table ----

  function _renderSummary(summary, colors) {
    var el = document.getElementById('calendar-summary');
    if (!el || !summary) return;

    var keys = _selectedShift === 'all' ? ['a','b','c','d'] : [_selectedShift];
    var html = '<div class="summary-title">ملخص الشهر</div><div class="summary-grid">';

    keys.forEach(function(k) {
      var data  = summary[k] || {};
      var shift = CONFIG.SHIFTS[k] || {};
      var color = colors[k] || shift.solid || '#999';
      html += '<div class="summary-card" style="border-top:3px solid ' + color + '">' +
        '<div class="summary-shift-label" style="color:' + color + '">وردية ' + (shift.label || k) + '</div>' +
        '<div class="summary-stats">' +
          '<div class="stat-row morning-stat"><span>' + (CONFIG.STATUS.morning.icon) + ' صباح</span><b>' + (data.morning || 0) + '</b></div>' +
          '<div class="stat-row evening-stat"><span>' + (CONFIG.STATUS.evening.icon) + ' مساء</span><b>' + (data.evening || 0) + '</b></div>' +
          '<div class="stat-row off-stat"><span>' + (CONFIG.STATUS.off.icon) + ' إجازة</span><b>' + (data.off || 0) + '</b></div>' +
        '</div>' +
      '</div>';
    });

    html += '</div>';
    el.innerHTML = html;
  }

  // ---- Mini calendar for vacation form ----

  function renderMini(containerId, startDate, endDate, shiftLetter) {
    var el = document.getElementById(containerId);
    if (!el) return;

    if (!startDate || !endDate || !shiftLetter) {
      el.innerHTML = '';
      return;
    }

    var start = new Date(startDate);
    var end   = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      el.innerHTML = '';
      return;
    }

    // Build lookup: dateStr → shift status for days in vacation range
    var inRange = {};
    var cur = new Date(start);
    while (cur <= end) {
      var ds = cur.getFullYear() + '-' + _pad(cur.getMonth() + 1) + '-' + _pad(cur.getDate());
      inRange[ds] = CONFIG.getShiftStatus(shiftLetter, ds);
      cur.setDate(cur.getDate() + 1);
    }

    // Collect months that the vacation spans
    var months = [];
    var mCur = new Date(start.getFullYear(), start.getMonth(), 1);
    var mEnd = new Date(end.getFullYear(), end.getMonth(), 1);
    while (mCur <= mEnd) {
      months.push({ year: mCur.getFullYear(), month: mCur.getMonth() + 1 });
      mCur.setMonth(mCur.getMonth() + 1);
    }

    var sk = CONFIG.shiftKey(shiftLetter);
    var shiftColor = (CONFIG.SHIFTS[sk] || {}).color || '#0066B3';

    var html = '<div class="mini-cal-wrap">';
    html += '<div class="mini-cal-title" style="color:' + shiftColor + '">📅 حالة الوردية خلال فترة الإجازة</div>';

    months.forEach(function(m) {
      html += '<div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin:6px 0 4px">' +
        CONFIG.MONTHS_AR[m.month - 1] + ' ' + m.year +
      '</div>';

      html += '<div class="mini-cal-table">';

      // Header: abbreviated day names (first letter)
      html += '<div class="mini-cal-head">';
      CONFIG.DAYS_AR.forEach(function(d) {
        html += '<div class="mini-head-cell">' + d.charAt(0) + '</div>';
      });
      html += '</div>';

      var firstDow    = new Date(m.year, m.month - 1, 1).getDay();
      var daysInMonth = new Date(m.year, m.month, 0).getDate();
      var dayOfRow    = 0;
      var rowHtml     = '<div class="mini-cal-row">';

      // Empty cells before first day
      for (var e = 0; e < firstDow; e++) {
        rowHtml += '<div class="mini-day-cell mini-day-empty"></div>';
        dayOfRow++;
      }

      for (var d = 1; d <= daysInMonth; d++) {
        var dateStr = m.year + '-' + _pad(m.month) + '-' + _pad(d);
        var st = inRange[dateStr];
        var date = new Date(m.year, m.month - 1, d);
        var hijri = Hijri.fromDate(date);

        if (st) {
          var sc = CONFIG.STATUS[st.en] || CONFIG.STATUS.off;
          rowHtml +=
            '<div class="mini-day-cell" style="background:' + sc.bg + ';color:' + sc.text + ';border-color:' + sc.text + '">' +
              '<span class="mdc-num">' + d + '</span>' +
              '<span class="mdc-hijri">' + hijri.day + ' ' + CONFIG.HIJRI_MONTHS[hijri.month - 1] + '</span>' +
              '<span class="mdc-icon">' + sc.icon + '</span>' +
              '<span class="mdc-lbl">' + sc.label + '</span>' +
            '</div>';
        } else {
          rowHtml +=
            '<div class="mini-day-cell" style="background:var(--bg-card,#fff);color:var(--text-muted,#aaa);border-color:var(--border,#e0e0e0);opacity:0.45">' +
              '<span class="mdc-num">' + d + '</span>' +
            '</div>';
        }

        dayOfRow++;
        if (dayOfRow === 7) {
          rowHtml += '</div>';
          html += rowHtml;
          rowHtml = '<div class="mini-cal-row">';
          dayOfRow = 0;
        }
      }

      // Close last partial row
      if (dayOfRow > 0) {
        while (dayOfRow < 7) {
          rowHtml += '<div class="mini-day-cell mini-day-empty"></div>';
          dayOfRow++;
        }
        rowHtml += '</div>';
        html += rowHtml;
      }

      html += '</div>'; // mini-cal-table
    });

    html += '</div>'; // mini-cal-wrap
    el.innerHTML = html;
  }

  // ---- Helpers ----

  function _pad(n) { return n < 10 ? '0' + n : String(n); }

  return { init: init, renderMini: renderMini };
})();
