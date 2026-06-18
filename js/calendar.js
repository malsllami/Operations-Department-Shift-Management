// ============================================================
// التقويم — كل يوم بطاقة مستقلة (هجري + ميلادي + حالة الورديات)
// ============================================================

var Calendar = (function () {

  var _currentYear      = new Date().getFullYear();
  var _currentMonth     = new Date().getMonth() + 1;
  var _scheduleData     = null;
  var _selectedShift    = 'all';
  var _containerId      = null;
  var _scrollToToday    = false;

  function init(containerId) {
    _containerId = containerId;
    _renderShell(containerId);
    _load(containerId);
  }

  // ---- حساب عنوان الشهر (ميلادي + هجري) ----

  function _updateTitle() {
    var titleEl = document.getElementById('cal-month-year');
    if (!titleEl) return;
    var hijriFirst = Hijri.fromDate(new Date(_currentYear, _currentMonth - 1, 1));
    var hijriLast  = Hijri.fromDate(new Date(_currentYear, _currentMonth,     0));
    var hijriStr = hijriFirst.month === hijriLast.month
      ? CONFIG.HIJRI_MONTHS[hijriFirst.month - 1] + ' ' + hijriFirst.year + ' هـ'
      : CONFIG.HIJRI_MONTHS[hijriFirst.month - 1] + ' / ' + CONFIG.HIJRI_MONTHS[hijriLast.month - 1] + ' ' + hijriLast.year + ' هـ';

    titleEl.innerHTML =
      '<div style="font-size:1.1rem;font-weight:800;color:var(--text);line-height:1.2">' +
        CONFIG.MONTHS_AR[_currentMonth - 1] + ' ' + _currentYear +
      '</div>' +
      '<div style="font-size:0.72rem;font-weight:600;color:var(--text-muted);text-align:center;margin-top:2px">' +
        hijriStr +
      '</div>';
  }

  // ---- Shell ----

  function _renderShell(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var dayHeaders = CONFIG.DAYS_AR.map(function(d) {
      return '<div class="cal-weekday">' + d + '</div>';
    }).join('');

    var shiftBtns =
      '<button class="shift-btn active" data-shift="all" style="padding:6px 14px;border:none;border-radius:50px;font-size:0.85rem;font-weight:700;cursor:pointer;background:var(--primary);color:#fff">الكل</button>' +
      '<button class="shift-btn" data-shift="a" style="padding:6px 14px;border:1.5px solid #1565C0;border-radius:50px;font-size:0.85rem;font-weight:700;cursor:pointer;background:transparent;color:#1565C0">☀ وردية أ</button>' +
      '<button class="shift-btn" data-shift="b" style="padding:6px 14px;border:1.5px solid #00838F;border-radius:50px;font-size:0.85rem;font-weight:700;cursor:pointer;background:transparent;color:#00838F">🌙 وردية ب</button>' +
      '<button class="shift-btn" data-shift="c" style="padding:6px 14px;border:1.5px solid #2E7D32;border-radius:50px;font-size:0.85rem;font-weight:700;cursor:pointer;background:transparent;color:#2E7D32">☀ وردية ج</button>' +
      '<button class="shift-btn" data-shift="d" style="padding:6px 14px;border:1.5px solid #6A1B9A;border-radius:50px;font-size:0.85rem;font-weight:700;cursor:pointer;background:transparent;color:#6A1B9A">🌙 وردية د</button>';

    el.innerHTML =
      // شريط التنقل
      '<div class="cal-nav-bar">' +
        '<button class="cal-nav-btn" id="cal-prev">&#8249;</button>' +
        '<div style="display:flex;flex-direction:column;align-items:center;gap:6px">' +
          '<div id="cal-month-year" style="text-align:center"></div>' +
          '<button class="cal-today-btn" id="cal-today">اليوم</button>' +
        '</div>' +
        '<button class="cal-nav-btn" id="cal-next">&#8250;</button>' +
      '</div>' +

      // فلاتر الورديات
      '<div id="shift-filter" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">' +
        shiftBtns +
      '</div>' +

      // شبكة التقويم (قابلة للتكبير بالإصبعين)
      '<div id="cal-zoom-outer" style="overflow:hidden;border-radius:12px;position:relative">' +
        '<div id="cal-zoom-wrap" style="transform-origin:top right;will-change:transform;transition:none">' +
          '<div class="cal-month-grid">' + dayHeaders + '</div>' +
          '<div class="cal-month-grid" id="calendar-grid">' +
            '<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:10px;padding:32px;color:var(--text-muted)">' +
              '<div class="spinner"></div><span>جارٍ التحميل...</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div id="calendar-summary" style="margin-top:16px"></div>';

    // إظهار عنوان الشهر الأولي
    _updateTitle();

    // ---- أحداث التنقل ----
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
    document.getElementById('cal-today').onclick = function() {
      var now      = new Date();
      _currentYear  = now.getFullYear();
      _currentMonth = now.getMonth() + 1;
      _scrollToToday = true;
      _load(containerId);
    };

    // ---- فلاتر الورديات ----
    el.querySelectorAll('.shift-btn').forEach(function(btn) {
      btn.onclick = function() {
        _selectedShift = this.dataset.shift;
        el.querySelectorAll('.shift-btn').forEach(function(b) {
          b.style.background = 'transparent';
          b.style.color      = b.dataset.shift === 'a' ? '#1565C0' :
                               b.dataset.shift === 'b' ? '#00838F' :
                               b.dataset.shift === 'c' ? '#2E7D32' :
                               b.dataset.shift === 'd' ? '#6A1B9A' : 'var(--primary)';
          b.classList.remove('active');
        });
        this.classList.add('active');
        this.style.background = 'var(--primary)';
        this.style.color      = '#fff';
        if (_scheduleData) _renderDays(_scheduleData);
      };
    });

    // ---- تكبير/تصغير بالإصبعين ----
    _addPinchZoom();
  }

  // ---- Pinch-to-zoom (مُصحَّح) ----

  function _addPinchZoom() {
    var outer  = document.getElementById('cal-zoom-outer');
    var inner  = document.getElementById('cal-zoom-wrap');
    if (!inner || !('ontouchstart' in window)) return;

    var _scale      = 1;
    var _lastScale  = 1;
    var _startDist  = 0;
    var _wasPinch   = false;   // هل اللمس كان بإصبعين؟
    var _lastTap    = 0;

    function _dist(t) {
      return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    }

    inner.addEventListener('touchstart', function(e) {
      if (e.touches.length === 2) {
        _startDist = _dist(e.touches);
        _wasPinch  = true;
        e.preventDefault();
      } else if (e.touches.length === 1) {
        _wasPinch = false;
      }
    }, { passive: false });

    inner.addEventListener('touchmove', function(e) {
      if (e.touches.length === 2) {
        _scale = Math.min(Math.max(_lastScale * (_dist(e.touches) / _startDist), 0.65), 2.8);
        inner.style.transform   = 'scale(' + _scale + ')';
        inner.style.width       = _scale > 1 ? (_scale * 100) + '%' : '';
        inner.style.height      = _scale > 1 ? (_scale * 100) + '%' : '';
        outer.style.overflowX   = _scale > 1 ? 'auto' : 'hidden';
        outer.style.overflowY   = _scale > 1 ? 'auto' : 'hidden';
        e.preventDefault();
      }
    }, { passive: false });

    // رفع جميع الأصابع — احفظ المقياس الأخير
    inner.addEventListener('touchend', function(e) {
      if (e.touches.length === 0) {
        _lastScale = _scale;

        // ضربة مزدوجة بإصبع واحد فقط → إعادة ضبط
        if (!_wasPinch) {
          var now = Date.now();
          if (now - _lastTap < 300 && Math.abs(_scale - 1) > 0.05) {
            _scale = _lastScale = 1;
            inner.style.transform = '';
            inner.style.width     = '';
            inner.style.height    = '';
            outer.style.overflowX = 'hidden';
            outer.style.overflowY = 'hidden';
          }
          _lastTap = now;
        }
        _wasPinch = false;
      }
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

    _updateTitle();

    API.getSchedule(_currentYear, _currentMonth).then(function(res) {
      if (!res.ok) {
        if (grid) {
          grid.innerHTML =
            '<div style="grid-column:1/-1;padding:40px;text-align:center;color:#EF4444">' +
              '<div style="font-size:2rem;margin-bottom:8px">⚠️</div>' +
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

    // التمرير إلى اليوم الحالي إذا طُلب
    if (_scrollToToday) {
      _scrollToToday = false;
      setTimeout(function() {
        var cell = document.querySelector('.cal-today');
        if (cell) {
          cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
          cell.style.outline = '3px solid var(--secondary)';
          cell.style.outlineOffset = '2px';
          setTimeout(function() { cell.style.outline = ''; cell.style.outlineOffset = ''; }, 1800);
        }
      }, 80);
    }
  }

  // ---- Build shift pills — ألوان واضحة في الفاتح والداكن ----

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

      // الخلفية شفافة، الأيقونة والنص بلون sc.badge (مشبع — يظهر في الفاتح والداكن)
      html +=
        '<div class="cal-shift-pill" style="' +
          'background:transparent;' +
          'border-color:' + color + ';' +
          'border-right:3px solid ' + color +
        '">' +
          '<span class="csp-letter" style="background:' + color + ';color:#fff;min-width:18px;text-align:center">' +
            (shift.label || s.key) +
          '</span>' +
          '<span class="csp-icon" style="font-size:0.95rem;color:' + sc.badge + '">' + sc.icon + '</span>' +
          '<span class="csp-txt" style="font-weight:700;color:' + sc.badge + '">' + sc.label + '</span>' +
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
            '<div class="csc-row"><span class="csc-icon" style="color:' + CONFIG.STATUS.morning.badge + '">' + CONFIG.STATUS.morning.icon + '</span><span class="csc-label" style="color:' + CONFIG.STATUS.morning.badge + ';font-weight:700">صباح</span><b class="csc-val">' + (data.morning || 0) + '</b></div>' +
            '<div class="csc-row"><span class="csc-icon" style="color:' + CONFIG.STATUS.evening.badge + '">' + CONFIG.STATUS.evening.icon + '</span><span class="csc-label" style="color:' + CONFIG.STATUS.evening.badge + ';font-weight:700">مساء</span><b class="csc-val">' + (data.evening || 0) + '</b></div>' +
            '<div class="csc-row"><span class="csc-icon" style="color:' + CONFIG.STATUS.off.badge    + '">' + CONFIG.STATUS.off.icon    + '</span><span class="csc-label" style="color:' + CONFIG.STATUS.off.badge    + ';font-weight:700">راحة</span><b class="csc-val">' + (data.off    || 0) + '</b></div>' +
          '</div>' +
          '<div class="csc-total"><span>المجموع</span><span style="color:' + color + ';font-size:1rem">' + total + ' يوم</span></div>' +
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

    var sk         = CONFIG.shiftKey(shiftLetter);
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
            '<div class="mini-day-cell" style="background:transparent;border-color:' + sc.badge + ';border-right:2px solid ' + sc.badge + '">' +
              '<span class="mdc-num" style="color:var(--text)">' + d + '</span>' +
              '<span class="mdc-hijri">' + hijri.day + ' ' + CONFIG.HIJRI_MONTHS[hijri.month - 1] + '</span>' +
              '<span class="mdc-icon" style="color:' + sc.badge + '">' + sc.icon + '</span>' +
              '<span class="mdc-lbl" style="color:' + sc.badge + ';font-weight:700">' + sc.label + '</span>' +
            '</div>';
        } else {
          rowHtml +=
            '<div class="mini-day-cell" style="background:transparent;border-color:var(--border,#e0e0e0);opacity:0.35">' +
              '<span class="mdc-num">' + d + '</span>' +
            '</div>';
        }
        dayOfRow++;
        if (dayOfRow === 7) {
          rowHtml += '</div>'; html += rowHtml;
          rowHtml = '<div class="mini-cal-row">'; dayOfRow = 0;
        }
      }
      if (dayOfRow > 0) {
        while (dayOfRow < 7) { rowHtml += '<div class="mini-day-cell mini-day-empty"></div>'; dayOfRow++; }
        rowHtml += '</div>'; html += rowHtml;
      }
      html += '</div>';
    });

    html += '</div>';
    el.innerHTML = html;
  }

  function _pad(n) { return n < 10 ? '0' + n : String(n); }

  return { init: init, renderMini: renderMini };
})();
