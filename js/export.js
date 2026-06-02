// ============================================================
// تصدير البيانات — Excel / PDF / طباعة
// ============================================================

var Export = (function () {

  // ============================================================
  // شريط التصدير المدمج (للموظفين / الإجازات / الأوفرتايم)
  // ============================================================
  function inlineBar(type, shift) {
    var s   = shift || '';
    var uid = 'eib_' + type + (s ? '_' + s.charCodeAt(0) : '');
    return '<div class="export-inline-bar">' +
      '<span class="eib-label">📤 تصدير:</span>' +
      '<div class="eib-dates">' +
        '<input type="date" id="' + uid + '_from" class="eib-date-input" title="من تاريخ">' +
        '<span class="eib-date-arrow">←</span>' +
        '<input type="date" id="' + uid + '_to"   class="eib-date-input" title="إلى تاريخ">' +
        '<button class="eib-period-btn" onclick="Export.setInlineDate(\'' + uid + '\',\'month\')">شهر</button>' +
        '<button class="eib-period-btn" onclick="Export.setInlineDate(\'' + uid + '\',\'year\')">سنة</button>' +
        '<button class="eib-period-btn" onclick="Export.setInlineDate(\'' + uid + '\',\'all\')">الكل</button>' +
      '</div>' +
      '<button class="btn-exp-sm btn-exp-xl"  onclick="Export.quickExport(\'' + type + '\',\'' + s + '\',\'excel\',\'' + uid + '\')">📊 Excel</button>' +
      '<button class="btn-exp-sm btn-exp-pdf" onclick="Export.quickExport(\'' + type + '\',\'' + s + '\',\'pdf\',\''   + uid + '\')">📄 PDF</button>' +
      '<button class="btn-exp-sm btn-exp-pr"  onclick="Export.quickExport(\'' + type + '\',\'' + s + '\',\'print\',\'' + uid + '\')">🖨️ طباعة</button>' +
    '</div>';
  }

  function setInlineDate(uid, period) {
    var today = new Date();
    var from = '', to = _dateStr(today);
    if (period === 'month') {
      from = _dateStr(new Date(today.getFullYear(), today.getMonth(), 1));
    } else if (period === 'year') {
      var d = new Date(today); d.setFullYear(d.getFullYear() - 1);
      from = _dateStr(d);
    } else {
      from = ''; to = '';
    }
    var fEl = document.getElementById(uid + '_from');
    var tEl = document.getElementById(uid + '_to');
    if (fEl) fEl.value = from;
    if (tEl) tEl.value = to;
  }

  // ============================================================
  // واجهة التصدير الكاملة (صفحة التصدير)
  // ============================================================
  function renderExportPanel(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var role    = Auth.getEffectiveRole();
    var isCoord = role === 'اداري';
    var isAdmin = role === 'مدير' || isCoord;
    var isSup   = role === 'مشرف';

    // ===== الإداري (التنسيق الإداري): لوحة مخصصة للأوفرتايم 5 أوراق =====
    if (isCoord) {
      el.innerHTML =
        '<div class="export-panel card">' +
          '<h3 class="section-title">تصدير بيانات العمل الإضافي</h3>' +
          '<p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:12px">يُصدَّر ملف Excel بـ 5 أوراق: جدول شامل لجميع الورديات + ورقة مستقلة لكل وردية</p>' +

          '<div class="form-grid">' +
            '<div class="form-field"><label>من تاريخ</label>' +
              '<input type="date" id="exp-from" class="form-input" onchange="Export.updateFileName()">' +
            '</div>' +
            '<div class="form-field"><label>إلى تاريخ</label>' +
              '<input type="date" id="exp-to" class="form-input" onchange="Export.updateFileName()">' +
            '</div>' +
          '</div>' +

          '<div class="export-period-btns">' +
            '<span class="period-label">الفترة:</span>' +
            '<button class="btn-period" onclick="Export.setDateRange(\'month\')">هذا الشهر</button>' +
            '<button class="btn-period" onclick="Export.setDateRange(\'half\')">6 أشهر</button>' +
            '<button class="btn-period" onclick="Export.setDateRange(\'year\')">سنة كاملة</button>' +
            '<button class="btn-period" onclick="Export.clearDates()">كل التواريخ</button>' +
          '</div>' +

          '<div class="export-filename-row">' +
            '<span class="filename-label">اسم الملف:</span>' +
            '<span id="exp-filename-preview" class="filename-preview">أوفرتايم_إداري_' + CONFIG.todayStr() + '.xls</span>' +
          '</div>' +

          '<div class="export-buttons">' +
            '<button class="btn-export btn-excel" onclick="Export.exportAdminOvertime()">📊 تصدير 5 أوراق Excel</button>' +
            '<button class="btn-export btn-print" onclick="Export.exportAdminOvertimePrint()">🖨️ طباعة / PDF</button>' +
          '</div>' +
          '<div id="exp-status" class="export-status"></div>' +
        '</div>';
      return;
    }

    // ===== باقي الأدوار =====
    var shiftField = '';
    if (isAdmin) {
      var shiftOpts = '<option value="">كل الورديات</option>' +
        ['أ','ب','ج','د'].map(function(s) {
          var sk = CONFIG.shiftKey(s);
          return '<option value="' + s + '">وردية ' + CONFIG.SHIFTS[sk].label + '</option>';
        }).join('');
      shiftField =
        '<div class="form-field"><label>الوردية</label>' +
          '<select id="exp-shift" class="form-select" onchange="Export.updateFileName()">' +
            shiftOpts +
          '</select>' +
        '</div>';
    } else if (isSup) {
      var myShift = Auth.getShift ? Auth.getShift() : '';
      var mySk    = myShift ? CONFIG.shiftKey(myShift) : '';
      var myColor = (mySk && CONFIG.SHIFTS[mySk]) ? CONFIG.SHIFTS[mySk].color : 'var(--primary)';
      var myLabel = (mySk && CONFIG.SHIFTS[mySk]) ? CONFIG.SHIFTS[mySk].label : myShift;
      shiftField =
        '<input type="hidden" id="exp-shift" value="' + myShift + '">' +
        '<div class="form-field"><label>الوردية</label>' +
          '<div class="form-static exp-shift-locked" style="background:' + myColor + ';color:#fff;border-radius:50px;text-align:center;font-weight:700">' +
            'وردية ' + myLabel + ' 🔒' +
          '</div>' +
        '</div>';
    } else {
      shiftField = '<input type="hidden" id="exp-shift" value="">';
    }

    var typeOptions = '';
    if (isAdmin) {
      typeOptions =
        '<option value="employees">الموظفون</option>' +
        '<option value="leaves">طلبات الإجازات</option>' +
        '<option value="overtime">العمل الإضافي</option>';
    } else if (isSup) {
      typeOptions =
        '<option value="employees">موظفو وردييتي</option>' +
        '<option value="leaves">إجازات وردييتي</option>' +
        '<option value="overtime">عمل إضافي وردييتي</option>';
    } else {
      typeOptions = '<option value="overtime">طلبات العمل الإضافي الخاصة بي</option>';
    }

    var compRow = isAdmin
      ? '<div class="export-comprehensive-row">' +
          '<label class="checkbox-label">' +
            '<input type="checkbox" id="exp-comprehensive" onchange="Export.updateFileName()"> ' +
            'تصدير شامل (4 جداول: الموظفون + أرصدة الإجازات + طلبات الإجازات + العمل الإضافي)' +
          '</label>' +
        '</div>'
      : (isSup
          ? '<div class="export-comprehensive-row">' +
              '<label class="checkbox-label">' +
                '<input type="checkbox" id="exp-comprehensive" onchange="Export.updateFileName()"> ' +
                'تصدير شامل وردييتي (الموظفون + الإجازات + العمل الإضافي)' +
              '</label>' +
            '</div>'
          : '');

    var html =
      '<div class="export-panel card">' +
        '<h3 class="section-title">تصدير البيانات' +
          (isSup ? ' — <span style="font-size:0.85rem;color:var(--text-muted)">وردييتي فقط</span>' : '') +
        '</h3>' +

        '<div class="form-grid">' +
          '<div class="form-field"><label>نوع البيانات</label>' +
            '<select id="exp-type" class="form-select" onchange="Export.onTypeChange()">' +
              typeOptions +
            '</select>' +
          '</div>' +
          shiftField +
          '<div class="form-field"><label>من تاريخ</label>' +
            '<input type="date" id="exp-from" class="form-input" onchange="Export.updateFileName()">' +
          '</div>' +
          '<div class="form-field"><label>إلى تاريخ</label>' +
            '<input type="date" id="exp-to" class="form-input" onchange="Export.updateFileName()">' +
          '</div>' +
        '</div>' +

        '<div class="export-period-btns">' +
          '<span class="period-label">الفترة:</span>' +
          '<button class="btn-period" onclick="Export.setDateRange(\'month\')">هذا الشهر</button>' +
          '<button class="btn-period" onclick="Export.setDateRange(\'half\')">6 أشهر</button>' +
          '<button class="btn-period" onclick="Export.setDateRange(\'year\')">سنة كاملة</button>' +
          '<button class="btn-period" onclick="Export.clearDates()">كل التواريخ</button>' +
        '</div>' +

        compRow +

        (isAdmin
          ? '<div class="export-sheets-row">' +
              '<span class="sheets-label">أوراق Excel:</span>' +
              '<label class="radio-opt"><input type="radio" name="exp-sheets" value="combined" checked onchange="Export.updateFileName()"> كل الورديات في ورقة واحدة</label>' +
              '<label class="radio-opt"><input type="radio" name="exp-sheets" value="per_shift" onchange="Export.updateFileName()"> ورقة مستقلة لكل وردية</label>' +
            '</div>'
          : '') +

        '<div class="export-filename-row">' +
          '<span class="filename-label">اسم الملف:</span>' +
          '<span id="exp-filename-preview" class="filename-preview"></span>' +
        '</div>' +

        '<div class="export-buttons">' +
          '<button class="btn-export btn-excel" onclick="Export.toExcel()">📊 تصدير Excel</button>' +
          '<button class="btn-export btn-pdf"   onclick="Export.toPDF()">📄 تصدير PDF</button>' +
          '<button class="btn-export btn-print" onclick="Export.print()">🖨️ طباعة</button>' +
        '</div>' +
        '<div id="exp-status" class="export-status"></div>' +
      '</div>';

    el.innerHTML = html;
    updateFileName();
  }

  // ============================================================
  // اختصارات الفترات الزمنية
  // ============================================================
  function setDateRange(period) {
    var today = new Date();
    var from, to = _dateStr(today);
    if (period === 'month') {
      from = _dateStr(new Date(today.getFullYear(), today.getMonth(), 1));
    } else if (period === 'half') {
      var d = new Date(today);
      d.setMonth(d.getMonth() - 6);
      from = _dateStr(d);
    } else if (period === 'year') {
      var d2 = new Date(today);
      d2.setFullYear(d2.getFullYear() - 1);
      from = _dateStr(d2);
    }
    var fromEl = document.getElementById('exp-from');
    var toEl   = document.getElementById('exp-to');
    if (fromEl) fromEl.value = from || '';
    if (toEl)   toEl.value   = to   || '';
    updateFileName();
  }

  function clearDates() {
    var fromEl = document.getElementById('exp-from');
    var toEl   = document.getElementById('exp-to');
    if (fromEl) fromEl.value = '';
    if (toEl)   toEl.value   = '';
    updateFileName();
  }

  function onTypeChange() {
    updateFileName();
  }

  function _dateStr(d) {
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  // ============================================================
  // تسمية الملف تلقائياً
  // ============================================================
  function _buildFileName(shift) {
    var role    = Auth.getEffectiveRole();
    var isAdmin = role === 'مدير' || role === 'اداري';
    var date    = CONFIG.todayStr();
    if (!isAdmin) {
      var myShift = (shift || (Auth.getShift ? Auth.getShift() : '')) || '';
      if (myShift) {
        var sk = CONFIG.shiftKey(myShift);
        if (sk && CONFIG.SHIFTS[sk]) return 'وردية_' + CONFIG.SHIFTS[sk].label + '_' + date;
      }
      return 'تصدير_' + date;
    }
    if (shift) {
      var sk2 = CONFIG.shiftKey(shift);
      if (sk2 && CONFIG.SHIFTS[sk2]) return 'وردية_' + CONFIG.SHIFTS[sk2].label + '_' + date;
    }
    var u = Auth.getUser();
    return ((u && u.name) ? u.name : 'تصدير') + '_' + date;
  }

  function updateFileName() {
    var el = document.getElementById('exp-filename-preview');
    if (!el) return;
    var shift = _val('exp-shift') || '';
    el.textContent = _buildFileName(shift) + '.xlsx';
  }

  // ============================================================
  // تصدير سريع (من الصفحة مباشرة)
  // ============================================================
  function quickExport(type, shift, format, uid) {
    var from = '', to = '';
    if (uid) {
      var fEl = document.getElementById(uid + '_from');
      var tEl = document.getElementById(uid + '_to');
      from = fEl ? fEl.value : '';
      to   = tEl ? tEl.value : '';
    }
    _quickGetData(type, shift, function(data) {
      data.from = from; data.to = to;
      if (format === 'excel') _doExcel(data);
      else if (format === 'pdf') _doPDF(data);
      else _doPrint(data);
    }, from, to);
  }

  // ============================================================
  // جلب البيانات — من عناصر UI
  // ============================================================
  function _getData(cb) {
    var compEl  = document.getElementById('exp-comprehensive');
    var isComp  = compEl && compEl.checked;
    var type    = _val('exp-type')  || 'employees';
    var shift   = _val('exp-shift') || '';
    var from    = _val('exp-from')  || '';
    var to      = _val('exp-to')    || '';
    var statusEl = document.getElementById('exp-status');
    if (statusEl) { statusEl.textContent = 'جارٍ تجميع البيانات...'; statusEl.className = 'export-status loading'; }

    if (isComp) {
      _getComprehensiveData(shift, from, to, function(data) {
        if (statusEl) { statusEl.textContent = ''; statusEl.className = 'export-status'; }
        cb(data);
      });
    } else {
      _quickGetData(type, shift, function(data) {
        data.from = from; data.to = to;
        if (statusEl) { statusEl.textContent = ''; statusEl.className = 'export-status'; }
        cb(data);
      }, from, to);
    }
  }

  // ============================================================
  // جلب البيانات — مباشرة بالمعامِلات
  // ============================================================
  function _quickGetData(type, shift, cb, from, to) {
    var role    = Auth.getEffectiveRole();
    var isAdmin = role === 'مدير' || role === 'اداري';
    var groupByShift = isAdmin && !shift;

    if (type === 'employees') {
      Promise.all([API.getEmployees(), API.getRegions(), API.getEquipment(), API.getLeaves()])
        .then(function(r) {
          var empList = r[0].ok ? r[0].data : [];
          var rgMap = {}; if (r[1].ok) r[1].data.forEach(function(x) { rgMap[x.empId] = x; });
          var eqMap = {}; if (r[2].ok) r[2].data.forEach(function(x) { eqMap[x.empId] = x; });
          var lvMap = {}; if (r[3].ok) r[3].data.forEach(function(x) { lvMap[x.empId] = x; });

          if (shift) empList = empList.filter(function(e) { return e.shift === shift; });

          var headers = ['الرقم الوظيفي','الاسم','الجوال','الوردية','الصلاحية',
                         'انتهاء بطاقة العمل','أيام متبقية','انتهاء بطاقة المصدر','أيام متبقية',
                         'المنطقة','المركز','السيارة',
                         'CAT2 قميص','CAT2 بنطلون','شوز','CAT4','برافو','ميجر','أخرى',
                         'رصيد السنوية','المستخدم','المتبقي','رصيد المجدولة','مرضية','مولود','وفاة','زواج','اختبارات'];

          var toRow = function(e) {
            var rg = rgMap[e.empId]||{}; var eq = eqMap[e.empId]||{}; var lv = lvMap[e.empId]||{};
            return [e.empId, e.name, e.phone ? '+966 '+e.phone : '',
                    e.shift, e.role,
                    CONFIG.fmtDate(e.workExpDate), e.workDaysLeft||'',
                    CONFIG.fmtDate(e.srcExpDate),  e.srcDaysLeft||'',
                    rg.region||'', rg.center||'', rg.car||'',
                    eq.cat2Shirt||'', eq.cat2Pants||'', eq.shoes||'', eq.cat4||'', eq.bravo||'', eq.major||'', eq.other||'',
                    lv.annBal||0, lv.annUsed||0, lv.annRem||0,
                    lv.schedBal||0,
                    lv.sick||'', lv.birth||'', lv.death||'', lv.marriage||'', lv.exam||''];
          };

          var rows = empList.map(toRow);
          cb({
            headers: headers, rows: rows, title: 'الموظفون',
            grouped: groupByShift,
            shiftGroups: groupByShift ? _buildShiftGroups(empList, toRow) : null,
            fileName: _buildFileName(shift)
          });
        });

    } else if (type === 'leaves') {
      API.getLeaveReqs({ from: from||'', to: to||'' }).then(function(r) {
        var list = r.ok ? r.data : [];
        if (shift) list = list.filter(function(x) { return x.shift === shift; });
        var headers = ['رقم الطلب','الرقم الوظيفي','الاسم','الوردية','نوع الإجازة',
                       'من تاريخ','إلى تاريخ','الأيام','الحالة','ملاحظات الموظف','المراجع'];
        var toRow = function(x) {
          return [x.no, x.empId, x.name, x.shift, _leaveTypeLabel(x.type),
                  CONFIG.fmtDate(x.startDate), CONFIG.fmtDate(x.endDate), x.days,
                  _statusLabel(x.status), x.empNotes||'', x.reviewerName||''];
        };
        var rows = list.map(toRow);
        cb({
          headers: headers, rows: rows, title: 'طلبات الإجازات',
          grouped: groupByShift,
          shiftGroups: groupByShift ? _buildShiftGroups(list, toRow) : null,
          fileName: _buildFileName(shift)
        });
      });

    } else if (type === 'overtime') {
      API.getOvertimeReqs({ from: from||'', to: to||'' }).then(function(r) {
        var list = r.ok ? r.data : [];
        if (shift) list = list.filter(function(x) { return x.shift === shift; });
        cb({
          headers: OT_FULL_HEADERS, rows: _buildOTRows(list), title: 'طلبات العمل الإضافي',
          grouped: groupByShift,
          shiftGroups: groupByShift ? _buildOTShiftGroups(list) : null,
          fileName: _buildFileName(shift)
        });
      });
    }
  }

  // ============================================================
  // جلب البيانات الشاملة (4 جداول)
  // ============================================================
  function _getComprehensiveData(shift, from, to, cb) {
    var role    = Auth.getEffectiveRole();
    var isAdmin = role === 'مدير' || role === 'اداري';
    var groupByShift = isAdmin && !shift;
    var fileName = _buildFileName(shift);

    Promise.all([
      API.getEmployees(),
      API.getRegions(),
      API.getEquipment(),
      API.getLeaves(),
      API.getLeaveReqs({ from: from||'', to: to||'' }),
      API.getOvertimeReqs({ from: from||'', to: to||'' })
    ]).then(function(r) {
      var empList = r[0].ok ? r[0].data : [];
      var rgMap = {}; if (r[1].ok) r[1].data.forEach(function(x) { rgMap[x.empId] = x; });
      var eqMap = {}; if (r[2].ok) r[2].data.forEach(function(x) { eqMap[x.empId] = x; });
      var lvMap = {}; if (r[3].ok) r[3].data.forEach(function(x) { lvMap[x.empId] = x; });
      var lrList = r[4].ok ? r[4].data : [];
      var otList = r[5].ok ? r[5].data : [];

      if (shift) {
        empList = empList.filter(function(e) { return e.shift === shift; });
        lrList  = lrList.filter(function(x)  { return x.shift === shift; });
        otList  = otList.filter(function(x)  { return x.shift === shift; });
      }

      // — الموظفون —
      var empHeaders = ['الرقم الوظيفي','الاسم','الجوال','الوردية','الصلاحية',
                        'انتهاء بطاقة العمل','أيام متبقية','انتهاء بطاقة المصدر','أيام متبقية',
                        'المنطقة','المركز','السيارة',
                        'CAT2 قميص','CAT2 بنطلون','شوز','CAT4','برافو','ميجر','أخرى'];
      var empToRow = function(e) {
        var rg = rgMap[e.empId]||{}; var eq = eqMap[e.empId]||{};
        return [e.empId, e.name, e.phone ? '+966 '+e.phone : '',
                e.shift, e.role,
                CONFIG.fmtDate(e.workExpDate), e.workDaysLeft||'',
                CONFIG.fmtDate(e.srcExpDate),  e.srcDaysLeft||'',
                rg.region||'', rg.center||'', rg.car||'',
                eq.cat2Shirt||'', eq.cat2Pants||'', eq.shoes||'', eq.cat4||'', eq.bravo||'', eq.major||'', eq.other||''];
      };

      // — أرصدة الإجازات —
      var lvHeaders = ['الرقم الوظيفي','الاسم','الوردية',
                       'رصيد سنوية','مستخدم سنوية','متبقي سنوية',
                       'رصيد مجدولة','مستخدم مجدولة','متبقي مجدولة',
                       'مرضية','مولود','وفاة','زواج','اختبارات','دورة عمل','خدمة طويلة','أخرى'];
      var lvToRow = function(e) {
        var lv = lvMap[e.empId]||{};
        return [e.empId, e.name, e.shift,
                lv.annBal||0, lv.annUsed||0, lv.annRem||0,
                lv.schedBal||0, lv.schedUsed||0, lv.schedRem||0,
                lv.sick||'', lv.birth||'', lv.death||'', lv.marriage||'', lv.exam||'',
                lv.workCourse||'', lv.longService||'', lv.otherTypes||''];
      };

      // — طلبات الإجازات —
      var lrHeaders = ['رقم الطلب','الرقم الوظيفي','الاسم','الوردية','نوع الإجازة',
                       'من تاريخ','إلى تاريخ','الأيام','الحالة','ملاحظات الموظف','المراجع'];
      var lrToRow = function(x) {
        return [x.no, x.empId, x.name, x.shift, _leaveTypeLabel(x.type),
                CONFIG.fmtDate(x.startDate), CONFIG.fmtDate(x.endDate), x.days,
                _statusLabel(x.status), x.empNotes||'', x.reviewerName||''];
      };

      cb({
        comprehensive: true,
        fileName: fileName,
        employees:    { title:'الموظفون',       headers:empHeaders, rows:empList.map(empToRow), grouped:groupByShift, shiftGroups:groupByShift?_buildShiftGroups(empList,empToRow):null },
        leaveBalance: { title:'أرصدة الإجازات', headers:lvHeaders,  rows:empList.map(lvToRow),  grouped:groupByShift, shiftGroups:groupByShift?_buildShiftGroups(empList,lvToRow):null  },
        leaveReqs:    { title:'طلبات الإجازات', headers:lrHeaders,  rows:lrList.map(lrToRow),   grouped:groupByShift, shiftGroups:groupByShift?_buildShiftGroups(lrList,lrToRow):null   },
        overtime:     { title:'العمل الإضافي',  headers:OT_FULL_HEADERS, rows:_buildOTRows(otList), grouped:groupByShift, shiftGroups:groupByShift?_buildOTShiftGroups(otList):null }
      });
    });
  }

  // ============================================================
  // رؤوس وصفوف الأوفرتايم الكاملة (جميع مراحل الطلب)
  // ============================================================
  var OT_FULL_HEADERS = [
    'رقم الطلب','الرقم الوظيفي','الاسم','الوردية',
    'تاريخ العمل الإضافي','اليوم','الساعات','السبب','الحالة الحالية',
    // الإنشاء
    'تاريخ الإنشاء',
    // مراجعة المشرف
    'تاريخ مراجعة المشرف','اسم المشرف','قرار المشرف','ملاحظات المشرف',
    // التنسيق الإداري
    'تاريخ وصول التنسيق الإداري','إجراء التنسيق الإداري','ملاحظات التنسيق',
    // الإرسال في النظام
    'تاريخ الإرسال في النظام',
    // الاستلام
    'حالة الاستلام','تاريخ الاستلام'
  ];

  var _COORD_ACTION = { send_system: 'إرسال للنظام', return_supervisor: 'إعادة للمشرف' };

  function _otFullRow(x) {
    // قرار المشرف: إذا كان هناك تاريخ مراجعة
    //   - رفض: status=rejected وCoordSentDate فارغ (أي الرفض كان في مرحلة المشرف)
    //   - اعتماد: خلاف ذلك
    var supDecision = x.supRevDate
      ? (x.status === 'مرفوض' && !x.coordSentDate ? 'رفض' : 'اعتماد')
      : 'لم يتم الإجراء';

    var coordActionLabel = x.coordSentDate
      ? (_COORD_ACTION[x.coordAction] || x.coordAction || '—')
      : 'لم يصل بعد';

    return [
      x.no, x.empId, x.name, x.shift,
      CONFIG.fmtDate(x.date), x.day, x.hours, x.reason,
      CONFIG.otStatusInfo(x.status).label,
      // إنشاء
      CONFIG.fmtDate(x.createdDate) || '—',
      // مشرف
      x.supRevDate   || 'لم يتم',
      x.supReviewerName || '—',
      supDecision,
      x.supNotes     || '—',
      // تنسيق
      x.coordSentDate  || 'لم يصل',
      coordActionLabel,
      x.coordNotes   || '—',
      // نظام
      x.systemSentDate || 'لم يتم',
      // استلام
      x.receiptStatus  || '—',
      x.receiptDate    || '—'
    ];
  }

  // بناء مجموعات الورديات للتصدير المجمّع
  function _buildShiftGroups(list, toRow) {
    var order = ['أ','ب','ج','د'];
    var groups = {};
    list.forEach(function(item) { var s = item.shift; (groups[s] = groups[s]||[]).push(item); });
    return order.filter(function(s) { return groups[s] && groups[s].length; }).map(function(s) {
      var sk = CONFIG.shiftKey(s);
      return {
        shift: s, label: CONFIG.SHIFTS[sk].label,
        color: CONFIG.SHIFTS[sk].color,
        bg: CONFIG.SHIFTS[sk].bg,
        rows: groups[s].map(toRow)
      };
    });
  }

  // قراءة وضع الأوراق (مدمج / ورقة لكل وردية)
  function _getSheetsMode() {
    var el = document.querySelector('input[name="exp-sheets"]:checked');
    return el ? el.value : 'combined';
  }

  // ============================================================
  // SpreadsheetML — مولّد Excel منسّق (ألوان + حدود + توسيط)
  // ============================================================

  // الألوان الخاصة بكل قسم
  var _SEC = {
    emp: { bg:'1565C0', fg:'FFFFFF', light:'DBEAFE', lightFg:'1E3A8A' },
    lv:  { bg:'00838F', fg:'FFFFFF', light:'CCFBF1', lightFg:'134E4A' },
    lr:  { bg:'2E7D32', fg:'FFFFFF', light:'DCFCE7', lightFg:'14532D' },
    ot:  { bg:'6A1B9A', fg:'FFFFFF', light:'F3E8FF', lightFg:'581C87' }
  };

  // ألوان الورديات (بدون #)
  var _SHIFT_HEX = { 'أ':'1565C0','ب':'00838F','ج':'2E7D32','د':'6A1B9A' };
  var _SHIFT_SK  = { 'أ':'a','ب':'b','ج':'c','د':'d' };

  function _smlEsc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  // الحالات التي تعني "تم الإرسال في النظام أو ما بعده"
  function _isSentToSystem(status) {
    return status === 'تم الإرسال للنظام' ||
           status === 'تم الاستلام'        ||
           status === 'لم يتم الاستلام';
  }

  // بناء صفوف الأوفرتايم مع علامة فاصل بين الجديدة والمرسلة للنظام
  function _buildOTRows(list) {
    var pending = list.filter(function(x) { return !_isSentToSystem(x.status); });
    var sent    = list.filter(function(x) { return  _isSentToSystem(x.status); });
    var rows = pending.map(_otFullRow);
    if (sent.length > 0) {
      rows.push({ __sep__: '▼  تم الإرسال في النظام  —  ' + sent.length + ' طلب  ▼' });
      sent.forEach(function(x) { rows.push(_otFullRow(x)); });
    }
    return rows;
  }

  // نسخة مُعدَّلة من _buildShiftGroups تستخدم _buildOTRows بدل .map(toRow)
  function _buildOTShiftGroups(list) {
    var order  = ['أ','ب','ج','د'];
    var groups = {};
    list.forEach(function(item) { var s = item.shift; (groups[s] = groups[s]||[]).push(item); });
    return order.filter(function(s) { return groups[s] && groups[s].length; }).map(function(s) {
      var sk = CONFIG.shiftKey(s);
      return {
        shift: s, label: CONFIG.SHIFTS[sk].label,
        color: CONFIG.SHIFTS[sk].color, bg: CONFIG.SHIFTS[sk].bg,
        rows: _buildOTRows(groups[s])
      };
    });
  }

  function _smlStyles() {
    // تعريف الأنماط: [id, bgHex, fgHex, bold, border, fontSize]
    var defs = [
      ['Default', '',       '000000', false, false, 10],
      ['data',    'FFFFFF', '000000', false, true,  10],
      ['data-alt','F5F5F5', '212121', false, true,  10],
      ['sep',     'FFFFFF', 'FFFFFF', false, false, 6 ],
      // فاصل "تم الإرسال في النظام"
      ['ot-sys-sep', 'FFF3CD', '7C4A00', true, true, 10],
      // عناوين الأقسام
      ['hdr-emp', _SEC.emp.bg, _SEC.emp.fg, true, true, 12],
      ['hdr-lv',  _SEC.lv.bg,  _SEC.lv.fg,  true, true, 12],
      ['hdr-lr',  _SEC.lr.bg,  _SEC.lr.fg,  true, true, 12],
      ['hdr-ot',  _SEC.ot.bg,  _SEC.ot.fg,  true, true, 12],
      // رؤوس الأعمدة
      ['col-emp', _SEC.emp.light, _SEC.emp.lightFg, true, true, 10],
      ['col-lv',  _SEC.lv.light,  _SEC.lv.lightFg,  true, true, 10],
      ['col-lr',  _SEC.lr.light,  _SEC.lr.lightFg,  true, true, 10],
      ['col-ot',  _SEC.ot.light,  _SEC.ot.lightFg,  true, true, 10],
      // رؤوس الورديات داخل القسم
      ['shift-a', '1565C0','FFFFFF', true, true, 11],
      ['shift-b', '00838F','FFFFFF', true, true, 11],
      ['shift-c', '2E7D32','FFFFFF', true, true, 11],
      ['shift-d', '6A1B9A','FFFFFF', true, true, 11]
    ];

    var xml = '<Styles>\n';
    defs.forEach(function(d) {
      var id=d[0], bg=d[1], fg=d[2], bold=d[3], border=d[4], fs=d[5];
      xml += '<Style ss:ID="' + id + '">\n';
      xml += ' <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="RightToLeft"/>\n';
      xml += ' <Font ss:FontName="Arial" ss:Size="' + fs + '"' +
             (bold ? ' ss:Bold="1"' : '') + ' ss:Color="#' + fg + '"/>\n';
      if (bg) xml += ' <Interior ss:Color="#' + bg + '" ss:Pattern="Solid"/>\n';
      if (border) {
        xml += ' <Borders>\n';
        ['Left','Right','Top','Bottom'].forEach(function(p) {
          xml += '  <Border ss:Position="' + p + '" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BDBDBD"/>\n';
        });
        xml += ' </Borders>\n';
      }
      xml += '</Style>\n';
    });
    xml += '</Styles>\n';
    return xml;
  }

  function _smlDataRow(cells, styleId, maxCols) {
    var xml = '<Row ss:Height="18">\n';
    var n = cells.length;
    for (var i = 0; i < Math.max(n, maxCols || n); i++) {
      var v  = i < n ? cells[i] : '';
      var tp = (typeof v === 'number' && v !== '' && !isNaN(v)) ? 'Number' : 'String';
      xml += '<Cell ss:StyleID="' + styleId + '"><Data ss:Type="' + tp + '">' +
             _smlEsc(v) + '</Data></Cell>\n';
    }
    xml += '</Row>\n';
    return xml;
  }

  function _smlMergedRow(label, numCols, styleId, height) {
    return '<Row ss:Height="' + (height||22) + '">\n' +
      '<Cell ss:StyleID="' + styleId + '" ss:MergeAcross="' + (numCols-1) + '">' +
      '<Data ss:Type="String">' + _smlEsc(label) + '</Data></Cell>\n</Row>\n';
  }

  function _smlSepRow(numCols) {
    var xml = '<Row ss:Height="8">\n';
    for (var i = 0; i < numCols; i++) xml += '<Cell ss:StyleID="sep"><Data ss:Type="String"></Data></Cell>\n';
    xml += '</Row>\n';
    return xml;
  }

  function _sectionKey(title) {
    if (!title) return 'emp';
    if (title.indexOf('أرصدة') >= 0 || title.indexOf('رصيد') >= 0) return 'lv';
    if (title.indexOf('إجازات') >= 0 || title.indexOf('اجازات') >= 0) return 'lr';
    if (title.indexOf('إضافي') >= 0 || title.indexOf('اضافي') >= 0) return 'ot';
    return 'emp';
  }

  // بناء XML ورقة عمل لمجموعة من الأقسام
  function _smlSheet(sheetName, sections, tabColor) {
    var maxCols = sections.reduce(function(m, s) { return Math.max(m, s.headers.length); }, 1);

    var xml = '<Worksheet ss:Name="' + _smlEsc(sheetName) + '">\n';
    xml += ' <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">\n';
    if (tabColor) xml += '  <TabColorIndex>0</TabColorIndex>\n';
    xml += '  <Unsynced/>\n </WorksheetOptions>\n';
    xml += '<Table ss:DefaultColumnWidth="100" ss:DefaultRowHeight="18">\n';
    for (var c = 0; c < maxCols; c++) xml += '<Column ss:Width="110"/>\n';

    sections.forEach(function(sec, si) {
      var key    = sec.key || _sectionKey(sec.title);
      var hdrSty = 'hdr-' + key;
      var colSty = 'col-' + key;

      // صف عنوان القسم (مدمج)
      xml += _smlMergedRow(sec.title, maxCols, hdrSty, 24);
      // رؤوس الأعمدة
      xml += _smlDataRow(sec.headers, colSty, maxCols);

      if (sec.shiftGroups && sec.shiftGroups.length) {
        sec.shiftGroups.forEach(function(g) {
          var sk    = _SHIFT_SK[g.shift] || 'a';
          var shSty = 'shift-' + sk;
          xml += _smlMergedRow('وردية ' + g.label, maxCols, shSty, 20);
          var dataRi = 0;
          g.rows.forEach(function(r) {
            if (r && !Array.isArray(r) && r.__sep__) {
              xml += _smlSepRow(maxCols);
              xml += _smlMergedRow(r.__sep__, maxCols, 'ot-sys-sep', 20);
              xml += _smlSepRow(maxCols);
              dataRi = 0;
              return;
            }
            xml += _smlDataRow(r, dataRi % 2 === 0 ? 'data' : 'data-alt', maxCols);
            dataRi++;
          });
        });
      } else {
        var dataRi2 = 0;
        (sec.rows || []).forEach(function(r) {
          if (r && !Array.isArray(r) && r.__sep__) {
            xml += _smlSepRow(maxCols);
            xml += _smlMergedRow(r.__sep__, maxCols, 'ot-sys-sep', 20);
            xml += _smlSepRow(maxCols);
            dataRi2 = 0;
            return;
          }
          xml += _smlDataRow(r, dataRi2 % 2 === 0 ? 'data' : 'data-alt', maxCols);
          dataRi2++;
        });
      }

      if (si < sections.length - 1) {
        xml += _smlSepRow(maxCols);
        xml += _smlSepRow(maxCols);
      }
    });

    xml += '</Table>\n</Worksheet>\n';
    return xml;
  }

  // توليد الملف الكامل وتنزيله
  function _smlDownload(sheets, fileName) {
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<?mso-application progid="Excel.Sheet"?>\n' +
      '<Workbook\n' +
      ' xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n' +
      ' xmlns:o="urn:schemas-microsoft-com:office:office"\n' +
      ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n' +
      ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n' +
      ' xmlns:html="http://www.w3.org/TR/REC-html40">\n' +
      '<ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">\n' +
      '<WindowHeight>12000</WindowHeight><WindowWidth>28000</WindowWidth>\n' +
      '</ExcelWorkbook>\n';

    xml += _smlStyles();
    sheets.forEach(function(ws) {
      xml += _smlSheet(ws.name, ws.sections, ws.tabColor);
    });
    xml += '</Workbook>';

    var blob = new Blob(['﻿' + xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = fileName + '.xls';
    document.body.appendChild(a); a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }

  // ============================================================
  // تصدير Excel — عادي (مع تنسيقات كاملة)
  // ============================================================
  function _doExcel(data) {
    if (data.comprehensive) {
      _getSheetsMode() === 'per_shift'
        ? _doExcelComprehensivePerShift(data)
        : _doExcelComprehensive(data);
      return;
    }
    var mode     = _getSheetsMode();
    var key      = _sectionKey(data.title);
    var fileName = data.fileName || data.title + '_' + CONFIG.todayStr();
    var sec      = { key: key, title: data.title, headers: data.headers,
                     rows: data.rows, shiftGroups: data.shiftGroups };

    if (mode === 'per_shift' && data.shiftGroups && data.shiftGroups.length) {
      var sheets = data.shiftGroups.map(function(g) {
        var sk = _SHIFT_SK[g.shift] || 'a';
        return {
          name: 'وردية ' + g.label,
          tabColor: _SHIFT_HEX[g.shift],
          sections: [{ key: key, title: data.title, headers: data.headers, rows: g.rows, shiftGroups: null }]
        };
      });
      _smlDownload(sheets, fileName);
    } else {
      _smlDownload([{ name: data.title, sections: [sec] }], fileName);
    }
  }

  function toExcel() { _getData(_doExcel); }

  // ============================================================
  // تصدير Excel — شامل / ورقة لكل نوع (مدمج)
  // ============================================================
  function _doExcelComprehensive(compData) {
    var fileName = compData.fileName || 'تصدير_شامل_' + CONFIG.todayStr();
    var sheets = [
      { name: compData.employees.title,    sections: [Object.assign({ key:'emp' }, compData.employees)]    },
      { name: compData.leaveBalance.title, sections: [Object.assign({ key:'lv'  }, compData.leaveBalance)] },
      { name: compData.leaveReqs.title,    sections: [Object.assign({ key:'lr'  }, compData.leaveReqs)]    },
      { name: compData.overtime.title,     sections: [Object.assign({ key:'ot'  }, compData.overtime)]     }
    ];
    _smlDownload(sheets, fileName);
  }

  // ============================================================
  // تصدير Excel — شامل / ورقات منفصلة لكل وردية ولكل نوع بيانات
  //
  // مدير/اداري (كل الورديات): 12 ورقة
  //   وردية أ - الموظفون | وردية أ - طلبات الإجازات | وردية أ - العمل الإضافي
  //   وردية ب - ...  (×3 لكل وردية)
  //
  // مشرف (وردييته فقط): 3 ورقات
  //
  // موظف: ورقتان (طلبات إجازاته / ساعاته الإضافية)
  // ============================================================
  function _doExcelComprehensivePerShift(compData) {
    var fileName = compData.fileName || 'تصدير_شامل_' + CONFIG.todayStr();
    var role     = Auth.getEffectiveRole();
    var isAdmin  = role === 'مدير' || role === 'اداري';
    var isSup    = role === 'مشرف';

    // ======= موظف: ورقتان فقط =======
    if (!isAdmin && !isSup) {
      var sheets = [
        { name: 'طلبات الإجازات', tabColor: '2E7D32',
          sections: [Object.assign({ key:'lr' }, compData.leaveReqs)] },
        { name: 'العمل الإضافي',  tabColor: '6A1B9A',
          sections: [Object.assign({ key:'ot' }, compData.overtime)] }
      ];
      _smlDownload(sheets, fileName);
      return;
    }

    // الأقسام الأربعة
    var empSec = Object.assign({ key:'emp' }, compData.employees);
    var lvSec  = Object.assign({ key:'lv'  }, compData.leaveBalance);
    var lrSec  = Object.assign({ key:'lr'  }, compData.leaveReqs);
    var otSec  = Object.assign({ key:'ot'  }, compData.overtime);

    // اجمع الورديات المتاحة
    var shiftOrder = ['أ','ب','ج','د'];
    var available  = shiftOrder.filter(function(s) {
      return [empSec, lvSec, lrSec, otSec].some(function(sec) {
        return sec.shiftGroups && sec.shiftGroups.some(function(g) { return g.shift === s; });
      });
    });

    // إذا لم يكن هناك تجميع بالورديات (مشرف أو وردية محددة بدون shiftGroups)
    // نُنشئ 3 ورقات للبيانات المتاحة بدون تصنيف وردية
    if (!available.length) {
      var shiftLabel = isSup ? (Auth.getShift ? Auth.getShift() : '') : '';
      var prefix     = shiftLabel ? 'وردية ' + shiftLabel + ' — ' : '';
      var sk0        = shiftLabel ? CONFIG.shiftKey(shiftLabel) : 'a';
      var tc0        = (CONFIG.SHIFTS[sk0] || CONFIG.SHIFTS.a).color.replace('#','');
      var sheets0 = [
        { name: prefix + 'الموظفون',        tabColor: tc0,
          sections: [{ key:'emp', title: empSec.title, headers: empSec.headers, rows: empSec.rows, shiftGroups: null },
                     { key:'lv',  title: lvSec.title,  headers: lvSec.headers,  rows: lvSec.rows,  shiftGroups: null }] },
        { name: prefix + 'طلبات الإجازات',  tabColor: '2E7D32',
          sections: [{ key:'lr', title: lrSec.title, headers: lrSec.headers, rows: lrSec.rows, shiftGroups: null }] },
        { name: prefix + 'العمل الإضافي',   tabColor: '6A1B9A',
          sections: [{ key:'ot', title: otSec.title, headers: otSec.headers, rows: otSec.rows, shiftGroups: null }] }
      ];
      _smlDownload(sheets0, fileName);
      return;
    }

    // مدير/اداري: 3 ورقات لكل وردية → N×3 ورقات
    function _shiftRows(sec, s) {
      if (!sec.shiftGroups) return sec.rows || [];
      var g = sec.shiftGroups.filter(function(g) { return g.shift === s; })[0];
      return g ? g.rows : [];
    }

    var sheets = [];
    available.forEach(function(s) {
      var sk = CONFIG.shiftKey(s);
      var sc = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
      var tc = sc.color.replace('#','');
      var pr = 'وردية ' + sc.label + ' — ';

      // ورقة 1: الموظفون + أرصدة الإجازات
      sheets.push({
        name: pr + 'الموظفون',
        tabColor: tc,
        sections: [
          { key:'emp', title: empSec.title, headers: empSec.headers, rows: _shiftRows(empSec, s), shiftGroups: null },
          { key:'lv',  title: lvSec.title,  headers: lvSec.headers,  rows: _shiftRows(lvSec, s),  shiftGroups: null }
        ]
      });

      // ورقة 2: طلبات الإجازات
      sheets.push({
        name: pr + 'طلبات الإجازات',
        tabColor: '2E7D32',
        sections: [
          { key:'lr', title: lrSec.title, headers: lrSec.headers, rows: _shiftRows(lrSec, s), shiftGroups: null }
        ]
      });

      // ورقة 3: العمل الإضافي
      sheets.push({
        name: pr + 'العمل الإضافي',
        tabColor: '6A1B9A',
        sections: [
          { key:'ot', title: otSec.title, headers: otSec.headers, rows: _shiftRows(otSec, s), shiftGroups: null }
        ]
      });
    });

    _smlDownload(sheets, fileName);
  }

  // ============================================================
  // تصدير الأوفرتايم الإداري — 5 أوراق
  // ورقة 1: شامل (كل الورديات، كل وردية بلونها + صف فراغ فاصل)
  // أوراق 2-5: ورقة مستقلة لكل وردية
  // ============================================================
  function _doAdminOvertimeExport(format) {
    var from     = _val('exp-from') || '';
    var to       = _val('exp-to')   || '';
    var dateSfx  = from ? (from + (to ? '_' + to : '')) : CONFIG.todayStr();
    var fileName = 'أوفرتايم_إداري_' + dateSfx;

    var statusEl = document.getElementById('exp-status');
    if (statusEl) { statusEl.textContent = 'جارٍ تجميع البيانات...'; statusEl.className = 'export-status loading'; }

    API.getOvertimeReqs({ from: from, to: to }).then(function(r) {
      if (statusEl) { statusEl.textContent = ''; statusEl.className = 'export-status'; }
      var list        = r.ok ? r.data : [];
      var allShifts   = ['أ','ب','ج','د'];
      var shiftGroups = _buildOTShiftGroups(list);

      if (format === 'print') {
        _doPrintAdminOvertime(list, shiftGroups, fileName, from, to);
        return;
      }

      // ورقة 1 — شامل (كل الورديات مجمّعة مع فصل المُرسَلة للنظام)
      var sheet1 = {
        name: 'الأوفرتايم الشامل',
        tabColor: '0066B3',
        sections: [{
          key: 'ot',
          title: 'طلبات العمل الإضافي — جميع الورديات' + (from ? ' (' + from + ' → ' + (to||'اليوم') + ')' : ''),
          headers: OT_FULL_HEADERS,
          rows: _buildOTRows(list),
          shiftGroups: shiftGroups
        }]
      };

      var sheets = [sheet1];

      // أوراق 2-5 — كل وردية مستقلة مع الفاصل
      allShifts.forEach(function(s) {
        var sk        = CONFIG.shiftKey(s);
        var sc        = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
        var shiftList = list.filter(function(x) { return x.shift === s; });
        sheets.push({
          name: 'وردية ' + sc.label,
          tabColor: sc.color.replace('#',''),
          sections: [{
            key: 'ot',
            title: 'العمل الإضافي — وردية ' + sc.label,
            headers: OT_FULL_HEADERS,
            rows: _buildOTRows(shiftList),
            shiftGroups: null
          }]
        });
      });

      _smlDownload(sheets, fileName);
    });
  }

  function exportAdminOvertime()      { _doAdminOvertimeExport('excel'); }
  function exportAdminOvertimePrint() { _doAdminOvertimeExport('print'); }

  function _doPrintAdminOvertime(list, shiftGroups, fileName, from, to) {
    var shifts   = CONFIG.SHIFTS;
    var shiftCss = Object.keys(shifts).map(function(k) {
      return '.shift-' + k + '{background:' + shifts[k].color + ';color:#fff;font-weight:700;text-align:center;padding:8px}';
    }).join('\n');

    // جدول شامل مع تلوين الورديات والفاصل بين المُرسَلة وغير المُرسَلة
    var numCols2  = OT_FULL_HEADERS.length;
    var tableHtml = '';
    shiftGroups.forEach(function(g) {
      var sk = CONFIG.shiftKey(g.shift);
      tableHtml += '<tr><td colspan="' + numCols2 + '" class="shift-' + sk + '">وردية ' + g.label + '</td></tr>';
      g.rows.forEach(function(row) {
        if (row && !Array.isArray(row) && row.__sep__) {
          tableHtml += '<tr><td colspan="' + numCols2 + '" class="ot-sys-sep-row">' + row.__sep__ + '</td></tr>';
          tableHtml += '<tr class="sep-row"><td colspan="' + numCols2 + '"></td></tr>';
          return;
        }
        tableHtml += '<tr>' + row.map(function(c) { return '<td>' + (c||'') + '</td>'; }).join('') + '</tr>';
      });
      tableHtml += '<tr class="sep-row"><td colspan="' + numCols2 + '"></td></tr>';
    });

    var period = from ? ('الفترة: ' + from + (to ? ' → ' + to : '')) : 'جميع الفترات';
    var html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>' + fileName + '</title><style>' +
      'body{font-family:Arial,sans-serif;font-size:10px;margin:12px}' +
      'h2{color:#0066B3;margin-bottom:4px}p.meta{color:#666;font-size:9px;margin-bottom:10px}' +
      'table{border-collapse:collapse;width:100%}' +
      'th{background:#0066B3;color:#fff;padding:5px;text-align:center;font-size:10px;border:1px solid #0055a0}' +
      'td{border:1px solid #ccc;padding:3px;text-align:center;font-size:9px}' +
      'tr:nth-child(even){background:#F9FAFB}.sep-row td{height:10px;border:none;background:#fff}' +
      '.ot-sys-sep-row{background:#FFF3CD;color:#7C4A00;font-weight:700;font-size:9px;padding:4px;border:1px solid #F6C343}' +
      shiftCss +
      '@media print{button{display:none}}</style></head><body>' +
      '<h2>طلبات العمل الإضافي — جميع الورديات</h2>' +
      '<p class="meta">تاريخ التصدير: ' + CONFIG.todayStr() + ' | ' + period + '</p>' +
      '<button onclick="window.print()" style="margin-bottom:10px;padding:5px 18px;background:#0066B3;color:#fff;border:none;border-radius:4px;cursor:pointer">🖨️ طباعة</button>' +
      '<table><thead><tr>' + OT_FULL_HEADERS.map(function(h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead>' +
      '<tbody>' + tableHtml + '</tbody></table>' +
      '</body></html>';

    var win = window.open('', '_blank');
    win.document.write(html);
    win.document.close(); win.focus();
  }

  // ============================================================
  // تصدير PDF
  // ============================================================
  function _doPDF(data) {
    if (data.comprehensive) { _doPrintComprehensive(data); return; }
    if (typeof jsPDF === 'undefined') { _doPrint(data); return; }
    var doc  = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    doc.setFontSize(14);
    doc.text(data.title + ' — ' + CONFIG.todayStr(), 10, 15);

    var allRows = [];
    if (data.grouped && data.shiftGroups && data.shiftGroups.length) {
      data.shiftGroups.forEach(function(g) {
        allRows.push(['═══ وردية ' + g.label + ' ═══']);
        g.rows.forEach(function(r) { allRows.push(r); });
        allRows.push([]);
      });
    } else {
      allRows = data.rows;
    }

    if (typeof doc.autoTable === 'function') {
      doc.autoTable({ head: [data.headers], body: allRows, startY: 20, styles: { font:'courier', fontSize:7 } });
    } else {
      var y = 25; doc.setFontSize(7);
      allRows.forEach(function(row) {
        if (y > 195) { doc.addPage(); y = 15; }
        doc.text(row.slice(0,8).join(' | '), 10, y); y += 5;
      });
    }
    var fileName = (data.fileName || data.title + '_' + CONFIG.todayStr()) + '.pdf';
    doc.save(fileName);
  }

  function toPDF() { _getData(_doPDF); }

  // ============================================================
  // طباعة — عادية مع تلوين الورديات
  // ============================================================
  function _doPrint(data) {
    if (data.comprehensive) { _doPrintComprehensive(data); return; }
    var win = window.open('', '_blank');
    var shifts = CONFIG.SHIFTS;
    var shiftCss = Object.keys(shifts).map(function(k) {
      return '.shift-' + k + '{background:' + shifts[k].color + ';color:#fff;font-weight:700;text-align:center;padding:8px}';
    }).join('\n');

    var tableHtml = '';
    var numCols   = data.headers.length;
    if (data.grouped && data.shiftGroups && data.shiftGroups.length) {
      data.shiftGroups.forEach(function(g) {
        var sk = CONFIG.shiftKey(g.shift);
        tableHtml += '<tr><td colspan="' + numCols + '" class="shift-' + sk + '">وردية ' + g.label + '</td></tr>';
        g.rows.forEach(function(row) {
          if (row && !Array.isArray(row) && row.__sep__) {
            tableHtml += '<tr><td colspan="' + numCols + '" class="ot-sys-sep-row">' + row.__sep__ + '</td></tr>';
            tableHtml += '<tr class="sep-row"><td colspan="' + numCols + '"></td></tr>';
            return;
          }
          tableHtml += '<tr>' + row.map(function(c) { return '<td>' + (c||'') + '</td>'; }).join('') + '</tr>';
        });
        tableHtml += '<tr class="sep-row"><td colspan="' + numCols + '"></td></tr>';
      });
    } else {
      data.rows.forEach(function(row) {
        if (row && !Array.isArray(row) && row.__sep__) {
          tableHtml += '<tr><td colspan="' + numCols + '" class="ot-sys-sep-row">' + row.__sep__ + '</td></tr>';
          tableHtml += '<tr class="sep-row"><td colspan="' + numCols + '"></td></tr>';
          return;
        }
        tableHtml += '<tr>' + row.map(function(c) { return '<td>' + (c||'') + '</td>'; }).join('') + '</tr>';
      });
    }

    win.document.write(_printHtml(data.title, data.headers, tableHtml, shiftCss));
    win.document.close(); win.focus();
  }

  function print() { _getData(_doPrint); }

  // ============================================================
  // طباعة — شاملة (4 جداول)
  // ============================================================
  function _doPrintComprehensive(compData) {
    var win = window.open('', '_blank');
    var shifts   = CONFIG.SHIFTS;
    var shiftCss = Object.keys(shifts).map(function(k) {
      return '.shift-' + k + '{background:' + shifts[k].color + ';color:#fff;font-weight:700;text-align:center;padding:8px}';
    }).join('\n');

    var sections = [compData.employees, compData.leaveBalance, compData.leaveReqs, compData.overtime];
    var allHtml  = '';

    sections.forEach(function(sec, idx) {
      if (idx > 0) allHtml += '<div class="section-sep"></div>';
      allHtml += '<h2 class="section-title-print">' + sec.title + '</h2>';

      var tableHtml = '';
      var nc = sec.headers.length;
      if (sec.grouped && sec.shiftGroups && sec.shiftGroups.length) {
        sec.shiftGroups.forEach(function(g) {
          var sk = CONFIG.shiftKey(g.shift);
          tableHtml += '<tr><td colspan="' + nc + '" class="shift-' + sk + '">وردية ' + g.label + '</td></tr>';
          g.rows.forEach(function(row) {
            if (row && !Array.isArray(row) && row.__sep__) {
              tableHtml += '<tr><td colspan="' + nc + '" class="ot-sys-sep-row">' + row.__sep__ + '</td></tr>';
              tableHtml += '<tr class="sep-row"><td colspan="' + nc + '"></td></tr>';
              return;
            }
            tableHtml += '<tr>' + row.map(function(c) { return '<td>' + (c||'') + '</td>'; }).join('') + '</tr>';
          });
          tableHtml += '<tr class="sep-row"><td colspan="' + nc + '"></td></tr>';
        });
      } else {
        sec.rows.forEach(function(row) {
          if (row && !Array.isArray(row) && row.__sep__) {
            tableHtml += '<tr><td colspan="' + nc + '" class="ot-sys-sep-row">' + row.__sep__ + '</td></tr>';
            tableHtml += '<tr class="sep-row"><td colspan="' + nc + '"></td></tr>';
            return;
          }
          tableHtml += '<tr>' + row.map(function(c) { return '<td>' + (c||'') + '</td>'; }).join('') + '</tr>';
        });
      }

      allHtml +=
        '<table><thead><tr>' +
          sec.headers.map(function(h) { return '<th>' + h + '</th>'; }).join('') +
        '</tr></thead><tbody>' + tableHtml + '</tbody></table>';
    });

    var title = compData.fileName || 'تصدير شامل';
    var html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">' +
      '<title>' + title + '</title><style>' +
      'body{font-family:Arial,sans-serif;font-size:11px;margin:16px}' +
      'h2.section-title-print{color:#0066B3;margin:16px 0 4px}' +
      'p.meta{color:#666;font-size:10px;margin-bottom:12px}' +
      'table{border-collapse:collapse;width:100%;margin-bottom:8px}' +
      'th{background:#0066B3;color:#fff;padding:6px;text-align:center;font-size:11px;border:1px solid #0055a0}' +
      'td{border:1px solid #ccc;padding:4px;text-align:center;font-size:10px}' +
      'tr:nth-child(even){background:#F9FAFB}' +
      '.sep-row td{height:10px;border:none;background:#fff}' +
      '.section-sep{height:24px}' +
      '.ot-sys-sep-row{background:#FFF3CD;color:#7C4A00;font-weight:700;font-size:10px;padding:5px;border:1px solid #F6C343}' +
      shiftCss +
      '@media print{button{display:none}.section-sep{page-break-before:always;height:0}}' +
      '</style></head><body>' +
      '<p class="meta">تاريخ التصدير: ' + CONFIG.todayStr() + '</p>' +
      '<button onclick="window.print()" style="margin-bottom:12px;padding:6px 20px;background:#0066B3;color:#fff;border:none;border-radius:4px;cursor:pointer">🖨️ طباعة</button>' +
      allHtml +
      '</body></html>';

    win.document.write(html);
    win.document.close(); win.focus();
  }

  // مساعد بناء صفحة الطباعة العادية
  function _printHtml(title, headers, tableHtml, shiftCss) {
    return '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">' +
      '<title>' + title + '</title><style>' +
      'body{font-family:Arial,sans-serif;font-size:11px;margin:16px}' +
      'h2{color:#0066B3;margin-bottom:4px}p.meta{color:#666;font-size:10px;margin-bottom:12px}' +
      'table{border-collapse:collapse;width:100%}' +
      'th{background:#0066B3;color:#fff;padding:6px;text-align:center;font-size:11px;border:1px solid #0055a0}' +
      'td{border:1px solid #ccc;padding:4px;text-align:center;font-size:10px}' +
      'tr:nth-child(even){background:#F9FAFB}.sep-row td{height:12px;border:none;background:#fff}' +
      '.ot-sys-sep-row{background:#FFF3CD;color:#7C4A00;font-weight:700;font-size:10px;padding:5px;border:1px solid #F6C343}' +
      shiftCss +
      '@media print{button{display:none}}</style></head><body>' +
      '<h2>' + title + '</h2>' +
      '<p class="meta">تاريخ التصدير: ' + CONFIG.todayStr() + '</p>' +
      '<button onclick="window.print()" style="margin-bottom:12px;padding:6px 20px;background:#0066B3;color:#fff;border:none;border-radius:4px;cursor:pointer">🖨️ طباعة</button>' +
      '<table><thead><tr>' +
        headers.map(function(h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + tableHtml + '</tbody></table>' +
      '</body></html>';
  }

  // ============================================================
  // مساعدات
  // ============================================================
  function _val(id) { var el = document.getElementById(id); return el ? el.value : ''; }

  function _leaveTypeLabel(key) {
    var t = CONFIG.LEAVE_TYPES.filter(function(l) { return l.key === key; })[0];
    return t ? t.label : (key||'—');
  }

  function _statusLabel(s) {
    return { pending_review:'قيد المراجعة', approved:'معتمد', rejected:'مرفوض' }[s] || s;
  }

  function exportDirect(compData, format) {
    if (format === 'excel') {
      _getSheetsMode() === 'per_shift'
        ? _doExcelComprehensivePerShift(compData)
        : _doExcelComprehensive(compData);
    } else {
      _doPrintComprehensive(compData);
    }
  }

  // واجهة عامة لجلب البيانات الشاملة (تُستخدم من dashboard.js وغيره)
  function getComprehensiveData(shift, from, to, cb) {
    _getComprehensiveData(shift || '', from || '', to || '', cb);
  }

  // ============================================================
  // تصدير الموظف — 3 ورقات: أرصدة الإجازات + طلبات الإجازات + العمل الإضافي
  // ============================================================
  function exportEmployee() {
    var user = Auth.getUser();
    if (!user) return;
    var empName  = user.name || 'موظف';
    var from     = _val('exp-from') || '';
    var to       = _val('exp-to')   || '';
    var dateSfx  = from ? '_' + from + (to ? '_' + to : '') : '';
    var fileName = empName + dateSfx + '_' + CONFIG.todayStr();

    var T_LV  = { annual:'سنوية',scheduled:'مجدولة',sick:'مرضية',birth:'مولود',death:'وفاة',marriage:'زواج',exam:'اختبار',work_course:'دورة',long_service:'خدمة' };
    var T_ST  = { pending_review:'قيد المراجعة', approved:'معتمد', rejected:'مرفوض' };

    Promise.all([
      API.getLeaves(),
      API.getLeaveReqs({ from: from, to: to }),
      API.getOvertimeReqs({ from: from, to: to })
    ]).then(function(r) {
      var lvList = (r[0].ok && r[0].data.length) ? [r[0].data[0]] : [];
      var lrList = r[1].ok ? r[1].data : [];
      var otList = r[2].ok ? r[2].data : [];

      // ورقة 1 — أرصدة الإجازات
      var lvHeaders = ['الرقم الوظيفي','الاسم','الوردية',
                       'رصيد سنوية','مستخدم','متبقي',
                       'رصيد مجدولة','مستخدم مجدولة','متبقي مجدولة',
                       'مرضية','مولود','وفاة','زواج','اختبارات','دورة عمل','خدمة طويلة','أخرى'];
      var lvRows = lvList.map(function(lv) {
        return [lv.empId, lv.name, lv.shift,
                lv.annBal||0, lv.annUsed||0, lv.annRem||0,
                lv.schedBal||0, lv.schedUsed||0, lv.schedRem||0,
                lv.sick||'', lv.birth||'', lv.death||'', lv.marriage||'',
                lv.exam||'', lv.workCourse||'', lv.longService||'', lv.otherTypes||''];
      });

      // ورقة 2 — طلبات الإجازات
      var lrHeaders = ['رقم الطلب','نوع الإجازة','من تاريخ','إلى تاريخ','الأيام','الحالة','ملاحظاتي','المراجع'];
      var lrRows = lrList.map(function(x) {
        return [x.no, T_LV[x.type]||x.type,
                CONFIG.fmtDate(x.startDate), CONFIG.fmtDate(x.endDate), x.days,
                T_ST[x.status]||x.status, x.empNotes||'', x.reviewerName||''];
      });

      // ورقة 3 — العمل الإضافي (مع جميع المراحل)
      var otRows = otList.map(_otFullRow);

      var sheets = [
        { name: 'أرصدة الإجازات',   tabColor: '00838F',
          sections: [{ key:'lv', title:'أرصدة الإجازات',   headers:lvHeaders, rows:lvRows, shiftGroups:null }] },
        { name: 'طلبات الإجازات',   tabColor: '2E7D32',
          sections: [{ key:'lr', title:'طلبات الإجازات',   headers:lrHeaders, rows:lrRows, shiftGroups:null }] },
        { name: 'العمل الإضافي',    tabColor: '6A1B9A',
          sections: [{ key:'ot', title:'العمل الإضافي',    headers:OT_FULL_HEADERS, rows:otRows, shiftGroups:null }] }
      ];
      _smlDownload(sheets, fileName);
    });
  }

  return {
    renderExportPanel,
    inlineBar,
    quickExport,
    toExcel,
    toPDF,
    print,
    setDateRange,
    clearDates,
    onTypeChange,
    updateFileName,
    exportDirect,
    getComprehensiveData,
    exportEmployee,
    exportAdminOvertime,
    exportAdminOvertimePrint,
    setInlineDate,
    OT_FULL_HEADERS: OT_FULL_HEADERS,
    otFullRow: _otFullRow
  };
})();
