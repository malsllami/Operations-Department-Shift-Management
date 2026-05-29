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
    var html = '<div class="export-panel card">' +
      '<h3 class="section-title">تصدير البيانات</h3>' +
      '<div class="form-grid">' +
        '<div class="form-field"><label>نوع البيانات</label>' +
          '<select id="exp-type" class="form-select">' +
            '<option value="employees">الموظفون</option>' +
            '<option value="leaves">الإجازات</option>' +
            '<option value="overtime">العمل الإضافي</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-field"><label>الوردية</label>' +
          '<select id="exp-shift" class="form-select">' +
            '<option value="">كل الورديات</option>' +
            ['أ','ب','ج','د'].map(function(s) {
              var sk = CONFIG.shiftKey(s);
              return '<option value="' + s + '">وردية ' + CONFIG.SHIFTS[sk].label + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="form-field"><label>من تاريخ</label>' +
          '<input type="date" id="exp-from" class="form-input">' +
        '</div>' +
        '<div class="form-field"><label>إلى تاريخ</label>' +
          '<input type="date" id="exp-to" class="form-input">' +
        '</div>' +
      '</div>' +
      '<div class="export-buttons">' +
        '<button class="btn-export btn-excel" onclick="Export.toExcel()">📊 تصدير Excel</button>' +
        '<button class="btn-export btn-pdf"   onclick="Export.toPDF()">📄 تصدير PDF</button>' +
        '<button class="btn-export btn-print" onclick="Export.print()">🖨️ طباعة</button>' +
      '</div>' +
      '<div id="exp-status" class="export-status"></div>' +
    '</div>';
    el.innerHTML = html;
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
    var type  = _val('exp-type')  || 'employees';
    var shift = _val('exp-shift') || '';
    var from  = _val('exp-from')  || '';
    var to    = _val('exp-to')    || '';
    var status = document.getElementById('exp-status');
    if (status) { status.textContent = 'جارٍ تجميع البيانات...'; status.className = 'export-status loading'; }
    _quickGetData(type, shift, function(data) {
      data.from = from; data.to = to;
      if (status) { status.textContent = ''; status.className = 'export-status'; }
      cb(data);
    }, from, to);
  }

  // ============================================================
  // جلب البيانات — مباشرة بالمعامِلات
  // ============================================================
  function _quickGetData(type, shift, cb, from, to) {
    var role    = Auth.getEffectiveRole();
    var isAdmin = role === 'مدير' || role === 'اداري';  // يرى كل الورديات
    var groupByShift = isAdmin && !shift;               // تجميع حسب الوردية للمدير فقط

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
                         'رصيد السنوية','المتبقي','رصيد المجدولة','مرضية','مولود','وفاة','زواج','اختبارات'];

          var toRow = function(e) {
            var rg = rgMap[e.empId]||{}; var eq = eqMap[e.empId]||{}; var lv = lvMap[e.empId]||{};
            return [e.empId, e.name, e.phone ? '+966 '+e.phone : '',
                    e.shift, e.role,
                    CONFIG.fmtDate(e.workExpDate), e.workDaysLeft||'',
                    CONFIG.fmtDate(e.srcExpDate),  e.srcDaysLeft||'',
                    rg.region||'', rg.center||'', rg.car||'',
                    eq.cat2Shirt||'', eq.cat2Pants||'', eq.shoes||'', eq.cat4||'', eq.bravo||'', eq.major||'', eq.other||'',
                    lv.annBal||'', lv.annRem||'', lv.schedBal||'', lv.sick||'', lv.birth||'', lv.death||'', lv.marriage||'', lv.exam||''];
          };

          var rows = empList.map(toRow);
          cb({
            headers: headers, rows: rows, title: 'الموظفون',
            grouped: groupByShift,
            shiftGroups: groupByShift ? _buildShiftGroups(empList, toRow) : null
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
          shiftGroups: groupByShift ? _buildShiftGroups(list, toRow) : null
        });
      });

    } else if (type === 'overtime') {
      API.getOvertimeReqs({ from: from||'', to: to||'' }).then(function(r) {
        var list = r.ok ? r.data : [];
        if (shift) list = list.filter(function(x) { return x.shift === shift; });
        var headers = ['رقم الطلب','الرقم الوظيفي','الاسم','الوردية','التاريخ','اليوم',
                       'الساعات','السبب','الحالة','تاريخ الإنشاء'];
        var toRow = function(x) {
          return [x.no, x.empId, x.name, x.shift, CONFIG.fmtDate(x.date), x.day,
                  x.hours, x.reason, CONFIG.otStatusInfo(x.status).label, CONFIG.fmtDate(x.createdDate)];
        };
        var rows = list.map(toRow);
        cb({
          headers: headers, rows: rows, title: 'طلبات العمل الإضافي',
          grouped: groupByShift,
          shiftGroups: groupByShift ? _buildShiftGroups(list, toRow) : null
        });
      });
    }
  }

  // بناء مجموعات الورديات للتصدير المجمّع
  function _buildShiftGroups(list, toRow) {
    var order = ['أ','ب','ج','د'];
    var groups = {};
    list.forEach(function(item) { var s = item.shift; (groups[s] = groups[s]||[]).push(item); });
    return order.filter(function(s) { return groups[s] && groups[s].length; }).map(function(s) {
      var sk = CONFIG.shiftKey(s);
      return {
        shift: s, label: 'وردية ' + CONFIG.SHIFTS[sk].label,
        color: CONFIG.SHIFTS[sk].color,
        bg: CONFIG.SHIFTS[sk].bg,
        rows: groups[s].map(toRow)
      };
    });
  }

  // ============================================================
  // تصدير Excel
  // ============================================================
  function _doExcel(data) {
    if (typeof XLSX === 'undefined') { alert('مكتبة SheetJS غير محملة'); return; }
    var wb = XLSX.utils.book_new();
    var wsData = [data.headers];

    if (data.grouped && data.shiftGroups && data.shiftGroups.length) {
      data.shiftGroups.forEach(function(g) {
        wsData.push(['═══ ' + g.label + ' ═══']);
        g.rows.forEach(function(r) { wsData.push(r); });
        wsData.push([]);  // صف فاصل فارغ
      });
    } else {
      data.rows.forEach(function(r) { wsData.push(r); });
    }

    var ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = data.headers.map(function() { return { wch: 18 }; });
    XLSX.utils.book_append_sheet(wb, ws, data.title);
    XLSX.writeFile(wb, data.title + '_' + CONFIG.todayStr() + '.xlsx');
  }

  function toExcel() { _getData(_doExcel); }

  // ============================================================
  // تصدير PDF
  // ============================================================
  function _doPDF(data) {
    if (typeof jsPDF === 'undefined') { alert('مكتبة jsPDF غير محملة'); return; }
    var doc  = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    doc.setFontSize(14);
    doc.text(data.title + ' — ' + CONFIG.todayStr(), 10, 15);

    var allRows = [];
    if (data.grouped && data.shiftGroups && data.shiftGroups.length) {
      data.shiftGroups.forEach(function(g) {
        allRows.push(['═══ ' + g.label + ' ═══']);
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
    doc.save(data.title + '_' + CONFIG.todayStr() + '.pdf');
  }

  function toPDF() { _getData(_doPDF); }

  // ============================================================
  // طباعة — مع تلوين الورديات
  // ============================================================
  function _doPrint(data) {
    var win = window.open('', '_blank');
    var shifts = CONFIG.SHIFTS;
    var shiftCss = ['a','b','c','d'].map(function(k) {
      return '.shift-' + k + ' { background:' + shifts[k].color + ';color:#fff;font-weight:700;text-align:center;padding:8px; }';
    }).join('\n');

    var tableHtml = '';
    if (data.grouped && data.shiftGroups && data.shiftGroups.length) {
      data.shiftGroups.forEach(function(g) {
        var sk = CONFIG.shiftKey(g.shift);
        tableHtml +=
          '<tr><td colspan="' + data.headers.length + '" class="shift-' + sk + '">' + g.label + '</td></tr>';
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

    var html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">' +
      '<title>' + data.title + '</title><style>' +
      'body{font-family:Arial,sans-serif;font-size:11px;margin:16px}' +
      'h2{color:#0066B3;margin-bottom:4px}p.meta{color:#666;font-size:10px;margin-bottom:12px}' +
      'table{border-collapse:collapse;width:100%}' +
      'th{background:#0066B3;color:#fff;padding:6px;text-align:center;font-size:11px}' +
      'td{border:1px solid #ccc;padding:4px;text-align:center;font-size:10px}' +
      'tr:nth-child(even){background:#F9FAFB}.sep-row td{height:12px;border:none;background:#fff}' +
      shiftCss +
      '@media print{button{display:none}}</style></head><body>' +
      '<h2>' + data.title + '</h2>' +
      '<p class="meta">تاريخ التصدير: ' + CONFIG.todayStr() + '</p>' +
      '<button onclick="window.print()" style="margin-bottom:12px;padding:6px 20px;background:#0066B3;color:#fff;border:none;border-radius:4px;cursor:pointer">🖨️ طباعة</button>' +
      '<table><thead><tr>' +
        data.headers.map(function(h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + tableHtml + '</tbody></table>' +
      '</body></html>';

    win.document.write(html);
    win.document.close();
    win.focus();
  }

  function print() { _getData(_doPrint); }

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

  return { renderExportPanel, inlineBar, quickExport, toExcel, toPDF, print };
})();
