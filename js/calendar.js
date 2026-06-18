// ============================================================
// التقويم — حساب محلي فوري بدون API
// ============================================================

var Calendar = (function () {

  var _currentYear   = new Date().getFullYear();
  var _currentMonth  = new Date().getMonth() + 1;
  var _scheduleData  = null;
  var _selectedShift = 'all';
  var _containerId   = null;
  var _scrollToToday = false;

  var _DAY_ABBR = ['أحد','اثن','ثلث','أرب','خمس','جمع','سبت'];

  function init(containerId) {
    _containerId = containerId;
    _injectStyles();
    _renderShell(containerId);
    _load();
  }

  // ---- حقن CSS مرة واحدة ----
  // يستخدم أسماء كلاسات مخصصة (cal-sp, csp-ltr, csp-ico, csp-lbl)
  // لتجنب التعارض مع CSS الموجود في style.css
  function _injectStyles() {
    var old = document.getElementById('cal-rsp-v3');
    if (old) return;
    var s = document.createElement('style');
    s.id = 'cal-rsp-v3';
    s.textContent =
      // ---- رأس أسماء الأيام ----
      '.cal-weekday { display:flex !important; align-items:center !important; justify-content:center !important; font-size:0.75rem !important; font-weight:700 !important; padding:6px 2px !important; color:var(--text-muted,#64748B) !important; overflow:hidden !important; white-space:nowrap !important; }' +
      '.cwd-abbr { display:none !important; }' +
      '@media(max-width:640px) {' +
        '.cwd-full { display:none !important; }' +
        '.cwd-abbr { display:inline !important; }' +
      '}' +

      // ---- شارة الوردية — بنية مستقلة كاملاً عن style.css ----
      '.cal-sp { display:flex; flex-direction:row; align-items:center; gap:3px; border-radius:6px; overflow:hidden; margin:1px 0; border:1px solid rgba(128,128,128,0.15); }' +
      '.csp-ltr { flex:0 0 auto; border-radius:4px; font-size:0.72rem; font-weight:800; padding:2px 5px; min-width:18px; text-align:center; line-height:1.4; }' +
      '.csp-ico { flex:0 0 auto; font-size:0.9rem; line-height:1; padding:0 1px; }' +
      '.csp-lbl { flex:1; font-size:0.72rem; font-weight:700; white-space:nowrap; overflow:hidden; display:none; }' +
      '@media(min-width:900px) { .csp-lbl { display:block; } }' +

      // الجوال: شارة أفقية مضغوطة (حرف + أيقونة في نفس السطر)
      '@media(max-width:640px) {' +
        '.cal-sp { flex-direction:row !important; padding:1px 3px; gap:2px; border-radius:4px; }' +
        '.csp-ltr { font-size:0.62rem; padding:1px 3px; border-radius:3px !important; min-width:14px; }' +
        '.csp-ico { font-size:0.72rem; line-height:1.3; }' +
      '}' +

      // ---- أزرار فلتر الورديات ----
      // كل زر: اسم الوردية + أيقونة الحالة في نفس السطر
      '.shift-btn { display:inline-flex !important; align-items:center; gap:5px; height:36px; padding:0 13px; border-radius:50px; cursor:pointer; font-family:inherit; flex-shrink:0; white-space:nowrap; transition:background 0.15s, color 0.15s; }' +
      // "وردية " يختفي في الجوال — يبقى الحرف + الأيقونة فقط
      '.sfb-pre { font-size:0.82rem; font-weight:600; transition:color 0.15s; }' +
      '.sfb-ltr { font-size:0.92rem; font-weight:800; transition:color 0.15s; }' +
      '.sfb-ico { display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%; border:1.5px solid; font-size:0.82rem; line-height:1; flex-shrink:0; transition:background 0.15s, border-color 0.15s; }' +
      '@media(max-width:600px) { .sfb-pre { display:none !important; } .shift-btn { padding:0 10px; gap:4px; } }' +

      // ---- زر اليوم ----
      '.cal-today-btn { padding:3px 12px; border:1.5px solid var(--primary); border-radius:50px; font-size:0.75rem; font-weight:700; cursor:pointer; background:transparent; color:var(--primary); line-height:1.6; }' +
      '.cal-today-btn:active { background:var(--primary); color:#fff; }';
    document.head.appendChild(s);
  }

  // ---- حساب بيانات الشهر محلياً ----
  function _buildMonthData(year, month) {
    var daysInMonth = new Date(year, month, 0).getDate();
    var schedule    = [];
    var summary     = {
      a: { morning:0, evening:0, off:0 },
      b: { morning:0, evening:0, off:0 },
      c: { morning:0, evening:0, off:0 },
      d: { morning:0, evening:0, off:0 }
    };
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = year + '-' + _pad(month) + '-' + _pad(d);
      var day = { date: dateStr };
      ['a','b','c','d'].forEach(function(sk) {
        var st  = CONFIG.getShiftStatus(CONFIG.SHIFTS[sk].label, dateStr);
        day[sk] = st.en;
        summary[sk][st.en]++;
      });
      schedule.push(day);
    }
    var colors = {};
    ['a','b','c','d'].forEach(function(sk) { colors[sk] = CONFIG.SHIFTS[sk].color; });
    return { ok: true, schedule: schedule, summary: summary, colors: colors };
  }

  // شارة أسطورة الألوان (legend pill)
  function _legendPill(badge, icon, label) {
    var r = parseInt(badge.slice(1,3),16);
    var g = parseInt(badge.slice(3,5),16);
    var b = parseInt(badge.slice(5,7),16);
    return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;' +
      'border-radius:50px;background:rgba(' + r + ',' + g + ',' + b + ',0.15);' +
      'border:1.5px solid rgba(' + r + ',' + g + ',' + b + ',0.40);' +
      'font-size:0.8rem;font-weight:700;color:' + badge + '">' +
      '<span style="font-size:0.9rem">' + icon + '</span>' + label +
    '</span>';
  }

  // خلفية شبه شفافة مضمونة الظهور في الوضع الفاتح والداكن
  function _pillBg(hexColor, alpha) {
    var r = parseInt(hexColor.slice(1,3), 16);
    var g = parseInt(hexColor.slice(3,5), 16);
    var b = parseInt(hexColor.slice(5,7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // ---- عنوان الشهر ----
  function _updateTitle() {
    var el = document.getElementById('cal-month-year');
    if (!el) return;
    var h1 = Hijri.fromDate(new Date(_currentYear, _currentMonth - 1, 1));
    var h2 = Hijri.fromDate(new Date(_currentYear, _currentMonth,     0));
    var hijriStr = h1.month === h2.month
      ? CONFIG.HIJRI_MONTHS[h1.month - 1] + ' ' + h1.year + ' هـ'
      : CONFIG.HIJRI_MONTHS[h1.month - 1] + ' / ' + CONFIG.HIJRI_MONTHS[h2.month - 1] + ' ' + h2.year + ' هـ';
    el.innerHTML =
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

    // أسماء أيام الأسبوع بالإنلاين لضمان الظهور بغض النظر عن style.css
    var dayHeaders = CONFIG.DAYS_AR.map(function(d, i) {
      return '<div class="cal-weekday">' +
        '<span class="cwd-full">' + d + '</span>' +
        '<span class="cwd-abbr">' + _DAY_ABBR[i] + '</span>' +
      '</div>';
    }).join('');

    // أسطورة الألوان (legend) — ثلاث حالات الدوام مع ألوانها
    var sc_m = CONFIG.STATUS.morning;
    var sc_e = CONFIG.STATUS.evening;
    var sc_o = CONFIG.STATUS.off;
    var legend =
      '<div id="cal-legend" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center;' +
        'padding:8px 14px;background:var(--bg-card,#fff);border-radius:12px;margin-bottom:10px;' +
        'box-shadow:0 2px 8px rgba(0,0,0,0.06)">' +
        '<span style="font-size:0.72rem;font-weight:700;color:var(--text-muted,#64748B)">دليل الألوان:</span>' +
        _legendPill(sc_m.badge, sc_m.icon, sc_m.label) +
        _legendPill(sc_e.badge, sc_e.icon, sc_e.label) +
        _legendPill(sc_o.badge, sc_o.icon, sc_o.label) +
      '</div>';

    // أزرار الفلتر — اسم الوردية فقط (لابتوب: "وردية أ"، جوال: "أ")
    var shiftBtns =
      '<button class="shift-btn active" data-shift="all"' +
      ' style="border:2px solid var(--primary);background:var(--primary);color:#fff;font-size:0.85rem;font-weight:700">' +
      'الكل</button>';
    ['a','b','c','d'].forEach(function(sk) {
      var shift = CONFIG.SHIFTS[sk];
      shiftBtns +=
        '<button class="shift-btn" data-shift="' + sk + '"' +
        ' data-sc="' + shift.color + '"' +
        ' style="border:2px solid ' + shift.color + ';background:transparent">' +
          '<span class="sfb-pre" style="color:' + shift.color + '">وردية </span>' +
          '<span class="sfb-ltr" style="color:' + shift.color + '">' + shift.label + '</span>' +
        '</button>';
    });

    el.innerHTML =
      '<div class="cal-nav-bar">' +
        '<button class="cal-nav-btn" id="cal-prev">&#8249;</button>' +
        '<div style="display:flex;flex-direction:column;align-items:center;gap:6px">' +
          '<div id="cal-month-year" style="text-align:center"></div>' +
          '<button class="cal-today-btn" id="cal-today">اليوم</button>' +
        '</div>' +
        '<button class="cal-nav-btn" id="cal-next">&#8250;</button>' +
      '</div>' +

      legend +

      '<div id="shift-filter" style="display:flex;gap:8px;margin-bottom:14px;align-items:center;flex-wrap:nowrap">' +
        shiftBtns +
      '</div>' +

      // رأس أسماء الأيام + الشبكة — كلاهما داخل zoom-wrap ليتزاموا معاً
      '<div id="cal-zoom-outer" style="overflow:hidden;border-radius:12px;position:relative">' +
        '<div id="cal-zoom-wrap" style="transform-origin:top right;will-change:transform">' +
          '<div class="cal-month-grid" style="background:var(--bg-card,#fff);border-radius:12px 12px 0 0;padding-bottom:4px">' +
            dayHeaders +
          '</div>' +
          '<div class="cal-month-grid" id="calendar-grid"></div>' +
        '</div>' +
      '</div>' +

      '<div id="calendar-summary" style="margin-top:16px"></div>';

    _updateTitle();

    document.getElementById('cal-prev').onclick = function() {
      _currentMonth--;
      if (_currentMonth < 1) { _currentMonth = 12; _currentYear--; }
      _load();
    };
    document.getElementById('cal-next').onclick = function() {
      _currentMonth++;
      if (_currentMonth > 12) { _currentMonth = 1; _currentYear++; }
      _load();
    };
    document.getElementById('cal-today').onclick = function() {
      var now       = new Date();
      _currentYear  = now.getFullYear();
      _currentMonth = now.getMonth() + 1;
      _scrollToToday = true;
      _load();
    };

    el.querySelectorAll('.shift-btn').forEach(function(btn) {
      btn.onclick = function() {
        _selectedShift = this.dataset.shift;

        // إعادة كل الأزرار للحالة الغير نشطة
        el.querySelectorAll('.shift-btn').forEach(function(b) {
          var bSk = b.dataset.shift;
          b.classList.remove('active');
          if (bSk === 'all') {
            b.style.background = 'transparent';
            b.style.border     = '2px solid var(--primary)';
            b.style.color      = 'var(--primary)';
          } else {
            var bColor = b.dataset.sc || '#999';
            b.style.background = 'transparent';
            b.style.border     = '2px solid ' + bColor;
            var pre = b.querySelector('.sfb-pre');
            var ltr = b.querySelector('.sfb-ltr');
            if (pre) pre.style.color = bColor;
            if (ltr) ltr.style.color = bColor;
            // إعادة أيقونة الحالة للحالة الطبيعية
            var ico = b.querySelector('.sfb-ico');
            if (ico && b.dataset.ic) {
              var r=parseInt(b.dataset.ic.slice(1,3),16), g=parseInt(b.dataset.ic.slice(3,5),16), bv=parseInt(b.dataset.ic.slice(5,7),16);
              ico.style.background    = 'rgba(' + r + ',' + g + ',' + bv + ',0.15)';
              ico.style.borderColor   = 'rgba(' + r + ',' + g + ',' + bv + ',0.45)';
              ico.style.color         = b.dataset.ic;
            }
          }
        });

        // تفعيل الزر المختار
        this.classList.add('active');
        if (this.dataset.shift === 'all') {
          this.style.background = 'var(--primary)';
          this.style.border     = '2px solid var(--primary)';
          this.style.color      = '#fff';
        } else {
          var aColor = this.dataset.sc || '#999';
          this.style.background = aColor;
          this.style.border     = '2px solid ' + aColor;
          var aPre = this.querySelector('.sfb-pre');
          var aLtr = this.querySelector('.sfb-ltr');
          if (aPre) aPre.style.color = '#fff';
          if (aLtr) aLtr.style.color = '#fff';
          // الأيقونة تصبح بخلفية بيضاء شفافة لتبرز على لون الوردية
          var aIco = this.querySelector('.sfb-ico');
          if (aIco) {
            aIco.style.background  = 'rgba(255,255,255,0.88)';
            aIco.style.borderColor = 'rgba(255,255,255,0.5)';
          }
        }

        if (_scheduleData) _renderDays(_scheduleData);
      };
    });

    _addPinchZoom();
  }

  // ---- تحميل فوري ----
  function _load() {
    _updateTitle();
    var res   = _buildMonthData(_currentYear, _currentMonth);
    _scheduleData = res;
    _renderDays(res);
  }

  // ---- رسم خلايا الأيام ----
  function _renderDays(res) {
    var grid = document.getElementById('calendar-grid');
    if (!grid) return;

    var schedule = res.schedule;
    var colors   = res.colors || {};
    var today    = new Date();
    var todayStr = today.getFullYear() + '-' + _pad(today.getMonth() + 1) + '-' + _pad(today.getDate());
    var firstDow = new Date(_currentYear, _currentMonth - 1, 1).getDay();
    var html     = '';

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

    if (_scrollToToday) {
      _scrollToToday = false;
      setTimeout(function() {
        var cell = document.querySelector('.cal-today');
        if (cell) {
          cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
          cell.style.outline       = '3px solid var(--secondary,#00AEEF)';
          cell.style.outlineOffset = '2px';
          setTimeout(function() { cell.style.outline = ''; cell.style.outlineOffset = ''; }, 1800);
        }
      }, 60);
    }
  }

  // ---- بناء شارات الورديات ----
  // الكلاس cal-sp مخصص ومستقل عن style.css تماماً
  // - alpha = 0.35 ضمان الظهور في الداكن والفاتح
  // - الشاشة الكبيرة: [حرف] [أيقونة] [نص]  أفقي
  // - الجوال: [حرف] فوق / [أيقونة] تحت  عمودي
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
      var bg    = _pillBg(sc.badge, 0.35); // alpha رفعناه لـ 0.35 للظهور في الداكن

      html +=
        '<div class="cal-sp" style="background:' + bg + ';border-right:3px solid ' + color + '">' +
          '<span class="csp-ltr" style="background:' + color + ';color:#fff">' +
            (shift.label || s.key) +
          '</span>' +
          '<span class="csp-ico" style="color:' + sc.badge + '">' +
            sc.icon +
          '</span>' +
          '<span class="csp-lbl" style="color:' + sc.badge + '">' +
            sc.label +
          '</span>' +
        '</div>';
    });
    return html;
  }

  // ---- ملخص الشهر ----
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
            _sumRow(CONFIG.STATUS.morning, data.morning || 0) +
            _sumRow(CONFIG.STATUS.evening, data.evening || 0) +
            _sumRow(CONFIG.STATUS.off,     data.off     || 0) +
          '</div>' +
          '<div class="csc-total"><span>المجموع</span>' +
            '<span style="color:' + color + ';font-weight:800">' + total + ' يوم</span>' +
          '</div>' +
        '</div>';
    });

    html += '</div>';
    el.innerHTML = html;
  }

  function _sumRow(sc, count) {
    return '<div class="csc-row">' +
      '<span class="csc-icon" style="color:' + sc.badge + '">' + sc.icon + '</span>' +
      '<span class="csc-label" style="color:' + sc.badge + ';font-weight:700">' + sc.label + '</span>' +
      '<b class="csc-val">' + count + '</b>' +
    '</div>';
  }

  // ---- Pinch-to-zoom ----
  function _addPinchZoom() {
    var outer = document.getElementById('cal-zoom-outer');
    var inner = document.getElementById('cal-zoom-wrap');
    if (!inner || !('ontouchstart' in window)) return;

    var _scale = 1, _lastScale = 1, _startDist = 0, _wasPinch = false, _lastTap = 0;

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
        inner.style.transform = 'scale(' + _scale + ')';
        inner.style.width     = _scale > 1 ? (_scale * 100) + '%' : '';
        inner.style.height    = _scale > 1 ? (_scale * 100) + '%' : '';
        outer.style.overflowX = _scale > 1 ? 'auto' : 'hidden';
        outer.style.overflowY = _scale > 1 ? 'auto' : 'hidden';
        e.preventDefault();
      }
    }, { passive: false });

    inner.addEventListener('touchend', function(e) {
      if (e.touches.length === 0) {
        _lastScale = _scale;
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

  // ---- التقويم المصغر للإجازات ----
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
    var html       = '<div class="mini-cal-wrap">';
    html += '<div class="mini-cal-title" style="color:' + shiftColor + '">📅 حالة الوردية خلال فترة الإجازة</div>';

    months.forEach(function(m) {
      html += '<div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin:6px 0 4px">' +
        CONFIG.MONTHS_AR[m.month - 1] + ' ' + m.year + '</div>';
      html += '<div class="mini-cal-table"><div class="mini-cal-head">';
      CONFIG.DAYS_AR.forEach(function(d) { html += '<div class="mini-head-cell">' + d.charAt(0) + '</div>'; });
      html += '</div>';

      var firstDow    = new Date(m.year, m.month - 1, 1).getDay();
      var daysInMonth = new Date(m.year, m.month, 0).getDate();
      var dayOfRow    = 0;
      var rowHtml     = '<div class="mini-cal-row">';

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
          var bg = _pillBg(sc.badge, 0.30);
          rowHtml +=
            '<div class="mini-day-cell" style="background:' + bg + ';border:1px solid rgba(128,128,128,0.15);border-right:2px solid ' + sc.badge + '">' +
              '<span class="mdc-num" style="color:var(--text)">' + d + '</span>' +
              '<span class="mdc-hijri">' + hijri.day + ' ' + CONFIG.HIJRI_MONTHS[hijri.month - 1] + '</span>' +
              '<span class="mdc-icon" style="color:' + sc.badge + '">' + sc.icon + '</span>' +
              '<span class="mdc-lbl" style="color:' + sc.badge + ';font-weight:700">' + sc.label + '</span>' +
            '</div>';
        } else {
          rowHtml +=
            '<div class="mini-day-cell" style="background:transparent;border:1px solid var(--border,#e0e0e0);opacity:0.35">' +
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
