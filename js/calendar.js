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

  // ---- Shell (navigation + filters + weekday headers) ----

  function _renderShell(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var dayHeaders = CONFIG.DAYS_AR.map(function(d) {
      return '<div class="cal-weekday">' + d + '</div>';
    }).join('');

    var shiftBtns =
      '<button class="shift-btn active" data-shift="all" style="padding:6px 14px;border:none;border-radius:50px;font-size:0.85rem;font-weight:700;cursor:pointer;background:var(--primary);color:#fff">الكل</button>' +
      '<button class="shift-btn" data-shift="a" style="padding:6px 14px;border:1.5px solid #DBEAFE;border-radius:50px;font-size:0.85rem;font-weight:700;cursor:pointer;background:#EFF6FF;color:var(--primary)">وردية أ</button>' +
      '<button class="shift-btn" data-shift="b" style="padding:6px 14px;border:1.5px solid #CCFBF1;border-radius:50px;font-size:0.85rem;font-weight:700;cursor:pointer;background:#F0FDF4;color:#00838F">وردية ب</button>' +
      '<button class="shift-btn" data-shift="c" style="padding:6px 14px;border:1.5px solid #DCFCE7;border-radius:50px;font-size:0.85rem;font-weight:700;cursor:pointer;background:#F0FDF4;color:#2E7D32">وردية ج</button>' +
      '<button class="shift-btn" data-shift="d" style="padding:6px 14px;border:1.5px solid #F3E8FF;border-radius:50px;font-size:0.85rem;font-weight:700;cursor:pointer;background:#FAF5FF;color:#6A1B9A">وردية د</button>';

    el.innerHTML =
      '<div class="cal-nav-bar">' +
        '<button class="cal-nav-btn" id="cal-prev">&#8249;</button>' +
        '<span class="cal-month-title" id="cal-month-year"></span>' +
        '<button class="cal-nav-btn" id="cal-next">&#8250;</button>' +
      '</div>' +

      '<div id="shift-filter" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">' +
        shiftBtns +
      '</div>' +

      '<div class="cal-month-grid">' + dayHeaders + '</div>' +

      '<div class="cal-month-grid" id="calendar-grid">' +
        '<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:10px;padding:32px;color:var(--text-muted)">' +
          '<div class="spinner"></div><span>جارٍ التحميل...</span>' +
        '</div>' +
      '</div>' +

      '<div id="calendar-summary"></div>';

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
        el.querySelectorAll('.shift-btn').forEach(function(b) {
          b.style.background = '';
          b.style.color      = '';
          b.classList.remove('active');
        });
        this.classList.add('active');
        this.style.background = 'var(--primary)';
        this.style.color      = '#fff';
        if (_scheduleData) _renderDays(_scheduleData);
      };
    });
  }

  // ---- Load from API ----

  function _load(containerId) {
    var grid = document.getElementById('calendar-grid');
    if (grid) {
      grid.innerHTML =
        '<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:10px;padding:32px;color:var(--text-muted)">' +
          '<div class="spinner"></div><span>جارٍ التحميل...</span>' +
        '</div>';
    }

    var titleEl = document.getElementById('cal-month-year');
    if (titleEl) titleEl.textContent = CONFIG.MONTHS_AR[_currentMonth - 1] + ' ' + _currentYear;

    API.getSchedule(_currentYear, _currentMonth).then(function(res) {
      if (!res.ok) {
        if (grid) {
          grid.innerHTML =
            '<div style="grid-column:1/-1;padding:40px;text-align:center;color:#EF4444">' +
              'تعذر تحميل البيانات — تحقق من الاتصال' +
            '</div>';
        }
        return;
      }
      _scheduleData = res;
      _renderDays(res);
    });
  }

  // ---- Render day cells ----

  function _renderDays(res) {
    var grid = document.getElementById('calendar-grid');
    if (!grid) return;

    var schedule = res.schedule;
    var colors   = res.colors || {};

    var today    = new Date();
    var todayStr = today.getFullYear() + '-' + _pad(today.getMonth() + 1) + '-' + _pad(today.getDate());

    var firstDow = new Date(_currentYear, _currentMonth - 1, 1).getDay();
    var html = '';

    for (var e = 0; e < firstDow; e++) {
      html += '<div class="cal-day-cell cal-day-empty"></div>';
    }

    schedule.forEach(function(day) {
      var date    = new Date(day.date);
      var hijri   = Hijri.fromDate(date);
      var isToday = day.date === todayStr;
      var dayNum  = parseInt(day.date.split('-')[2]);

      html +=
        '<div class="cal-day-cell' + (isToday ? ' cal-today' : '') + '">' +
          '<div class="cal-day-header">' +
            '<span class="cal-day-num' + (isToday ? ' cal-today-num' : '') + '">' + dayNum + '</span>' +
            '<span class="cal-day-hijri">' + hijri.day + ' ' + CONFIG.HIJRI_MONTHS[hijri.month - 1] + '</span>' +
          '</div>' +
          '<div class="cal-day-shifts">' + _buildShiftRows(day, colors) + '</div>' +
        '</div>';
    });

    grid.innerHTML = html;
    _renderSummary(res.summary, colors);
  }

  // ---- Build shift pills ----

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
      var color = colors[s.key] || shift.color || '#999';
      html +=
        '<div class="cal-shift-pill" style="background:' + sc.bg + ';border-color:' + color + ';color:' + sc.text + '">' +
          '<span class="csp-letter" style="background:' + color + '">' + (shift.label || s.key) + '</span>' +
          '<span class="csp-icon">' + sc.icon + '</span>' +
          '<span class="csp-txt">' + sc.label + '</span>' +
        '</div>';
    });
    return html;
  }

  // ---- Summary cards ----

  function _renderSummary(summary, colors) {
    var el = document.getElementById('calendar-summary');
    if (!el || !summary) return;

    var keys = _selectedShift === 'all' ? ['a','b','c','d'] : [_selectedShift];
    var html = '<div class="cal-summary-cards">';

    keys.forEach(function(k) {
      var data  = summary[k] || {};
      var shift = CONFIG.SHIFTS[k] || {};
      var color = colors[k] || shift.color || '#999';
      var total = (data.morning || 0) + (data.evening || 0) + (data.off || 0);
      html +=
        '<div class="cal-sum-card" style="border-top:3px solid ' + color + '">' +
          '<div class="csc-title" style="color:' + color + '">وردية ' + (shift.label || k) + '</div>' +
          '<div class="csc-rows">' +
            '<div class="csc-row"><span class="csc-icon">' + CONFIG.STATUS.morning.icon + '</span><span class="csc-label">صباح</span><b class="csc-val">' + (data.morning || 0) + '</b></div>' +
            '<div class="csc-row"><span class="csc-icon">' + CONFIG.STATUS.evening.icon + '</span><span class="csc-label">مساء</span><b class="csc-val">' + (data.evening || 0) + '</b></div>' +
            '<div class="csc-row"><span class="csc-icon">' + CONFIG.STATUS.off.icon    + '</span><span class="csc-label">راحة</span><b class="csc-val">' + (data.off    || 0) + '</b></div>' +
          '</div>' +
          '<div class="csc-total"><span>المجموع</span><span>' + total + ' يوم</span></div>' +
        '</div>';
    });

    html += '</div>';
    el.innerHTML = html;
  }

  // ---- Mini calendar for vacation form ----

  function renderMini(containerId, startDate, endDate, shiftLetter) {
    var el = document.getElementById(containerId);
    if (!el) return;

    if (!startDate || !endDate || !shiftLetter) { el.innerHTML = ''; return; }

    var start = new Date(startDate);
    var end   = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) { el.innerHTML = ''; return; }

    var inRange = {};
    var cur = new Date(start);
    while (cur <= end) {
      var ds = cur.getFullYear() + '-' + _pad(cur.getMonth() + 1) + '-' + _pad(cur.getDate());
      inRange[ds] = CONFIG.getShiftStatus(shiftLetter, ds);
      cur.setDate(cur.getDate() + 1);
    }

    var months = [];
    var mCur = new Date(start.getFullYear(), start.getMonth(), 1);
    var mEnd = new Date(end.getFullYear(), end.getMonth(), 1);
    while (mCur <= mEnd) {
      months.push({ year: mCur.getFullYear(), month: mCur.getMonth() + 1 });
      mCur.setMonth(mCur.getMonth() + 1);
    }

    var sk = CONFIG.shiftKey(shiftLetter);
    var shiftColor = (CONFIG.SHIFTS[sk] || {}).color || 'var(--primary)';

    var html = '<div class="mini-cal-wrap">';
    html += '<div class="mini-cal-title" style="color:' + shiftColor + '">📅 حالة الوردية خلال فترة الإجازة</div>';

    months.forEach(function(m) {
      html += '<div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin:6px 0 4px">' +
        CONFIG.MONTHS_AR[m.month - 1] + ' ' + m.year + '</div>';

      html += '<div class="mini-cal-table">';
      html += '<div class="mini-cal-head">';
      CONFIG.DAYS_AR.forEach(function(d) { html += '<div class="mini-head-cell">' + d.charAt(0) + '</div>'; });
      html += '</div>';

      var firstDow    = new Date(m.year, m.month - 1, 1).getDay();
      var daysInMonth = new Date(m.year, m.month, 0).getDate();
      var dayOfRow = 0;
      var rowHtml  = '<div class="mini-cal-row">';

      for (var e = 0; e < firstDow; e++) {
        rowHtml += '<div class="mini-day-cell mini-day-empty"></div>';
        dayOfRow++;
      }

      for (var d = 1; d <= daysInMonth; d++) {
        var dateStr = m.year + '-' + _pad(m.month) + '-' + _pad(d);
        var st      = inRange[dateStr];
        var date    = new Date(m.year, m.month - 1, d);
        var hijri   = Hijri.fromDate(date);

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
            '<div class="mini-day-cell" style="background:var(--bg-card,#fff);color:var(--text-muted,#aaa);border-color:var(--border,#e0e0e0);opacity:0.4">' +
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

      if (dayOfRow > 0) {
        while (dayOfRow < 7) { rowHtml += '<div class="mini-day-cell mini-day-empty"></div>'; dayOfRow++; }
        rowHtml += '</div>';
        html += rowHtml;
      }

      html += '</div>';
    });

    html += '</div>';
    el.innerHTML = html;
  }

  function _pad(n) { return n < 10 ? '0' + n : String(n); }

  return { init: init, renderMini: renderMini };
})();
