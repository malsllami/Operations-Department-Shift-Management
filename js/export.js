// ============================================================
// تصدير البيانات — Excel / PDF / طباعة
// ============================================================

var Export = (function () {

  // ============================================================
  // شريط التصدير المدمج (للموظفين / الإجازات / الأوفرتايم)
  // ============================================================
  function inlineBar(type, shift) {
    var s = shift || '';
    return '<div class="export-inline-bar">' +
      '<span class="eib-label">📤 تصدير:</span>' +
      '<button class="btn-exp-sm btn-exp-xl" onclick="Export.quickExport(\'' + type + '\',\'' + s + '\',\'excel\')">📊 Excel</button>' +
      '<button class="btn-exp-sm btn-exp-pdf" onclick="Export.quickExport(\'' + type + '\',\'' + s + '\',\'pdf\')">📄 PDF</button>' +
      '<button class="btn-exp-sm btn-exp-pr"  onclick="Export.quickExport(\'' + type + '\',\'' + s + '\',\'print\')">🖨️ طباعة</button>' +
    '</div>';
  }

  // ============================================================
  // واجهة التصدير الكاملة (صفحة التصدير)
  // ============================================================
  function renderExportPanel(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var role    = Auth.getEffectiveRole();
    var isAdmin = role === 'مدير' || role === 'اداري';
    var isSup   = role === 'مشرف';

    // حقل الوردية حسب الدور
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
      // موظف — لا يصل للوحة التصدير عادةً، لكن احتياطاً
      shiftField = '<input type="hidden" id="exp-shift" value="">';
    }

    // أنواع البيانات حسب الدور
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

    // التصدير الشامل — للمدير والإداري فقط
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
  function quickExport(type, shift, format) {
    _quickGetData(type, shift, function(data) {
      if (format === 'excel') _doExcel(data);
      else if (format === 'pdf') _doPDF(data);
      else _doPrint(data);
    });
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
        var rows = list.map(_otFullRow);
        cb({
          headers: OT_FULL_HEADERS, rows: rows, title: 'طلبات العمل الإضافي',
          grouped: groupByShift,
          shiftGroups: groupByShift ? _buildShiftGroups(list, _otFullRow) : null,
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

      // — العمل الإضافي (جميع المراحل) —
      var otToRow = _otFullRow;

      cb({
        comprehensive: true,
        fileName: fileName,
        employees:    { title:'الموظفون',       headers:empHeaders, rows:empList.map(empToRow), grouped:groupByShift, shiftGroups:groupByShift?_buildShiftGroups(empList,empToRow):null },
        leaveBalance: { title:'أرصدة الإجازات', headers:lvHeaders,  rows:empList.map(lvToRow),  grouped:groupByShift, shiftGroups:groupByShift?_buildShiftGroups(empList,lvToRow):null  },
        leaveReqs:    { title:'طلبات الإجازات', headers:lrHeaders,  rows:lrList.map(lrToRow),   grouped:groupByShift, shiftGroups:groupByShift?_buildShiftGroups(lrList,lrToRow):null   },
        overtime:     { title:'العمل الإضافي',  headers:OT_FULL_HEADERS, rows:otList.map(otToRow), grouped:groupByShift, shiftGroups:groupByShift?_buildShiftGroups(otList,otToRow):null }
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
      ? (x.status === 'rejected' && !x.coordSentDate ? 'رفض' : 'اعتماد')
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

  // إضافة لون التبويب للورقة في workbook
  function _setTabColor(wb, sheetIndex, hexColor) {
    wb.Workbook = wb.Workbook || { Sheets: [] };
    while (wb.Workbook.Sheets.length <= sheetIndex) wb.Workbook.Sheets.push({});
    wb.Workbook.Sheets[sheetIndex].TabColor = { rgb: 'FF' + hexColor.replace('#','') };
  }

  // بناء worksheet موحّدة (مساعدة)
  function _buildWs(headers, groups, allRows) {
    var wsData = [headers];
    if (groups && groups.length) {
      groups.forEach(function(g) {
        wsData.push(['══ وردية ' + g.label + ' ══']);
        g.rows.forEach(function(r) { wsData.push(r); });
        wsData.push([]);
      });
    } else {
      (allRows || []).forEach(function(r) { wsData.push(r); });
    }
    var ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = headers.map(function() { return { wch: 20 }; });
    return ws;
  }

  // ============================================================
  // تصدير Excel — عادي
  // ============================================================
  function _doExcel(data) {
    if (data.comprehensive) {
      _getSheetsMode() === 'per_shift' ? _doExcelComprehensivePerShift(data) : _doExcelComprehensive(data);
      return;
    }
    if (typeof XLSX === 'undefined') { alert('مكتبة SheetJS غير محملة'); return; }
    var mode = _getSheetsMode();
    var fileName = (data.fileName || data.title + '_' + CONFIG.todayStr()) + '.xlsx';

    if (mode === 'per_shift' && data.shiftGroups && data.shiftGroups.length) {
      // ورقة مستقلة لكل وردية
      var wb = XLSX.utils.book_new();
      data.shiftGroups.forEach(function(g, idx) {
        var wsData = [data.headers];
        g.rows.forEach(function(r) { wsData.push(r); });
        var ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = data.headers.map(function() { return { wch: 20 }; });
        XLSX.utils.book_append_sheet(wb, ws, 'وردية ' + g.label);
        _setTabColor(wb, idx, g.color);
      });
      XLSX.writeFile(wb, fileName);
    } else {
      // ورقة واحدة مدمجة
      var wb2 = XLSX.utils.book_new();
      var ws2 = _buildWs(data.headers, data.grouped ? data.shiftGroups : null, data.rows);
      XLSX.utils.book_append_sheet(wb2, ws2, data.title);
      XLSX.writeFile(wb2, fileName);
    }
  }

  function toExcel() { _getData(_doExcel); }

  // ============================================================
  // تصدير Excel — شامل (ورقة لكل نوع بيانات — مدمج)
  // ============================================================
  function _doExcelComprehensive(compData) {
    if (typeof XLSX === 'undefined') { alert('مكتبة SheetJS غير محملة'); return; }
    var wb = XLSX.utils.book_new();
    var sections = [compData.employees, compData.leaveBalance, compData.leaveReqs, compData.overtime];
    sections.forEach(function(sec) {
      var ws = _buildWs(sec.headers, sec.grouped ? sec.shiftGroups : null, sec.rows);
      XLSX.utils.book_append_sheet(wb, ws, sec.title);
    });
    XLSX.writeFile(wb, (compData.fileName || 'تصدير_شامل_' + CONFIG.todayStr()) + '.xlsx');
  }

  // ============================================================
  // تصدير Excel — شامل (ورقة مستقلة لكل وردية — للمدير/الإداري فقط)
  // ============================================================
  function _doExcelComprehensivePerShift(compData) {
    if (typeof XLSX === 'undefined') { alert('مكتبة SheetJS غير محملة'); return; }
    var wb = XLSX.utils.book_new();
    var sections = [compData.employees, compData.leaveBalance, compData.leaveReqs, compData.overtime];

    // اجمع الورديات المتاحة من أي قسم
    var shiftOrder = ['أ','ب','ج','د'];
    var availableShifts = [];
    shiftOrder.forEach(function(s) {
      var found = false;
      sections.forEach(function(sec) {
        if (sec.shiftGroups) {
          sec.shiftGroups.forEach(function(g) { if (g.shift === s) found = true; });
        }
      });
      if (found) availableShifts.push(s);
    });

    if (!availableShifts.length) {
      // لا يوجد تجميع حسب ورديات → نتراجع للأسلوب المدمج
      _doExcelComprehensive(compData); return;
    }

    availableShifts.forEach(function(s, sheetIdx) {
      var sk = CONFIG.shiftKey(s);
      var sc = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
      var wsData = [];

      sections.forEach(function(sec) {
        // عنوان القسم
        wsData.push([sec.title]);

        // رؤوس الأعمدة
        wsData.push(sec.headers);

        // بيانات هذه الوردية فقط
        var shiftRows = [];
        if (sec.shiftGroups) {
          sec.shiftGroups.forEach(function(g) {
            if (g.shift === s) shiftRows = g.rows;
          });
        }
        shiftRows.forEach(function(r) { wsData.push(r); });
        wsData.push([]); // فاصل فارغ
      });

      var ws = XLSX.utils.aoa_to_sheet(wsData);
      // عرض الأعمدة بناءً على أطول قسم
      var maxCols = sections.reduce(function(m, sec) { return Math.max(m, sec.headers.length); }, 0);
      ws['!cols'] = Array(maxCols).fill({ wch: 20 });
      XLSX.utils.book_append_sheet(wb, ws, 'وردية ' + sc.label);
      _setTabColor(wb, sheetIdx, sc.color);
    });

    XLSX.writeFile(wb, (compData.fileName || 'تصدير_شامل_' + CONFIG.todayStr()) + '.xlsx');
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
    if (data.grouped && data.shiftGroups && data.shiftGroups.length) {
      data.shiftGroups.forEach(function(g) {
        var sk = CONFIG.shiftKey(g.shift);
        tableHtml +=
          '<tr><td colspan="' + data.headers.length + '" class="shift-' + sk + '">وردية ' + g.label + '</td></tr>';
        g.rows.forEach(function(row) {
          tableHtml += '<tr>' + row.map(function(c) { return '<td>' + (c||'') + '</td>'; }).join('') + '</tr>';
        });
        tableHtml += '<tr class="sep-row"><td colspan="' + data.headers.length + '"></td></tr>';
      });
    } else {
      tableHtml = data.rows.map(function(row) {
        return '<tr>' + row.map(function(c) { return '<td>' + (c||'') + '</td>'; }).join('') + '</tr>';
      }).join('');
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
      if (sec.grouped && sec.shiftGroups && sec.shiftGroups.length) {
        sec.shiftGroups.forEach(function(g) {
          var sk = CONFIG.shiftKey(g.shift);
          tableHtml +=
            '<tr><td colspan="' + sec.headers.length + '" class="shift-' + sk + '">وردية ' + g.label + '</td></tr>';
          g.rows.forEach(function(row) {
            tableHtml += '<tr>' + row.map(function(c) { return '<td>' + (c||'') + '</td>'; }).join('') + '</tr>';
          });
          tableHtml += '<tr class="sep-row"><td colspan="' + sec.headers.length + '"></td></tr>';
        });
      } else {
        tableHtml = sec.rows.map(function(row) {
          return '<tr>' + row.map(function(c) { return '<td>' + (c||'') + '</td>'; }).join('') + '</tr>';
        }).join('');
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
    OT_FULL_HEADERS: OT_FULL_HEADERS,
    otFullRow: _otFullRow
  };
})();
