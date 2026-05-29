// ============================================================
// تصدير البيانات — Excel / PDF / طباعة
// (يستخدم SheetJS لـ Excel و jsPDF لـ PDF)
// ============================================================

var Export = (function () {

  // ============================================================
  // واجهة التصدير
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
            '<option value="comprehensive">العرض الشامل</option>' +
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
  // جلب البيانات للتصدير
  // ============================================================

  function _getData(cb) {
    var type  = _val('exp-type')  || 'employees';
    var shift = _val('exp-shift') || '';
    var from  = _val('exp-from')  || '';
    var to    = _val('exp-to')    || '';

    var status = document.getElementById('exp-status');
    if (status) { status.textContent = 'جارٍ تجميع البيانات...'; status.className = 'export-status loading'; }

    var prom;
    if (type === 'employees') {
      prom = Promise.all([API.getEmployees(), API.getRegions(), API.getEquipment(), API.getLeaves()]).then(function(r) {
        var empList = r[0].ok ? r[0].data : [];
        var rgMap   = {}; if (r[1].ok) r[1].data.forEach(function(x) { rgMap[x.empId] = x; });
        var eqMap   = {}; if (r[2].ok) r[2].data.forEach(function(x) { eqMap[x.empId] = x; });
        var lvMap   = {}; if (r[3].ok) r[3].data.forEach(function(x) { lvMap[x.empId] = x; });

        if (shift) empList = empList.filter(function(e) { return e.shift === shift; });

        var headers = ['الرقم الوظيفي','الاسم','الجوال','الوردية','الصلاحية',
                       'انتهاء العمل','مدة العمل','انتهاء المصدر','مدة المصدر',
                       'المنطقة','المركز','السيارة',
                       'CAT2 قميص','CAT2 بنطلون','سيفتي شوز','CAT4','برافو','ميجر','أخرى',
                       'رصيد السنوية','المتبقي','رصيد المجدولة','مرضية','مولود','وفاة','زواج','اختبارات'];
        var rows = empList.map(function(e) {
          var rg = rgMap[e.empId] || {}; var eq = eqMap[e.empId] || {}; var lv = lvMap[e.empId] || {};
          return [e.empId, e.name, '+966 '+e.phone, e.shift, e.role,
                  CONFIG.fmtDate(e.workExpDate), e.workDaysLeft||'', CONFIG.fmtDate(e.srcExpDate), e.srcDaysLeft||'',
                  rg.region||'', rg.center||'', rg.car||'',
                  eq.cat2Shirt||'', eq.cat2Pants||'', eq.shoes||'', eq.cat4||'', eq.bravo||'', eq.major||'', eq.other||'',
                  lv.annBal||'', lv.annRem||'', lv.schedBal||'', lv.sick||'', lv.birth||'', lv.death||'', lv.marriage||'', lv.exam||''];
        });
        return { headers: headers, rows: rows, title: 'الموظفون', shiftRows: _groupByShift(empList, rows) };
      });
    } else if (type === 'leaves') {
      prom = API.getLeaveReqs({ from: from, to: to }).then(function(r) {
        var list = r.ok ? r.data : [];
        if (shift) list = list.filter(function(x) { return x.shift === shift; });
        var headers = ['رقم الطلب','الرقم الوظيفي','الاسم','الوردية','نوع الإجازة',
                       'تاريخ البداية','تاريخ النهاية','الأيام','الحالة','ملاحظات','المراجع'];
        var rows = list.map(function(x) {
          return [x.no, x.empId, x.name, x.shift, _leaveTypeLabel(x.type),
                  CONFIG.fmtDate(x.startDate), CONFIG.fmtDate(x.endDate), x.days, _statusLabel(x.status),
                  x.empNotes||'', x.reviewerName||''];
        });
        return { headers: headers, rows: rows, title: 'طلبات الإجازات' };
      });
    } else if (type === 'overtime') {
      prom = API.getOvertimeReqs({ from: from, to: to }).then(function(r) {
        var list = r.ok ? r.data : [];
        if (shift) list = list.filter(function(x) { return x.shift === shift; });
        var headers = ['رقم الطلب','الرقم الوظيفي','الاسم','الوردية','التاريخ','اليوم',
                       'الساعات','السبب','الحالة','تاريخ الإنشاء'];
        var rows = list.map(function(x) {
          return [x.no, x.empId, x.name, x.shift, CONFIG.fmtDate(x.date), x.day,
                  x.hours, x.reason, CONFIG.otStatusInfo(x.status).label, CONFIG.fmtDate(x.createdDate)];
        });
        return { headers: headers, rows: rows, title: 'طلبات العمل الإضافي' };
      });
    } else {
      prom = API.buildComprehensiveView().then(function(r) {
        if (!r.ok) return { headers:[], rows:[], title:'العرض الشامل' };
        return API.getEmployees().then(function(er) {
          if (!er.ok) return { headers:[], rows:[], title:'العرض الشامل' };
          var list = er.data;
          if (shift) list = list.filter(function(e) { return e.shift === shift; });
          return { headers:['الموظفون'], rows: list.map(function(e) { return [e.empId, e.name, e.shift, e.role]; }),
                   title: 'العرض الشامل' };
        });
      });
    }

    prom.then(function(data) {
      if (status) { status.textContent = ''; status.className = 'export-status'; }
      cb(data);
    }).catch(function() {
      if (status) { status.textContent = 'حدث خطأ أثناء جلب البيانات'; status.className = 'export-status error'; }
    });
  }

  // ============================================================
  // تصدير Excel (SheetJS)
  // ============================================================

  function toExcel() {
    if (typeof XLSX === 'undefined') {
      alert('مكتبة SheetJS غير محملة — تحقق من الاتصال بالإنترنت'); return;
    }
    _getData(function(data) {
      var wb = XLSX.utils.book_new();
      var wsData = [data.headers].concat(data.rows);
      var ws     = XLSX.utils.aoa_to_sheet(wsData);

      // تنسيق رأس الجدول (XLSX لا يدعم ألوان مباشرة بدون مكتبة مدفوعة)
      ws['!cols'] = data.headers.map(function() { return { wch: 20 }; });

      XLSX.utils.book_append_sheet(wb, ws, data.title);
      XLSX.writeFile(wb, data.title + '_' + CONFIG.todayStr() + '.xlsx');
    });
  }

  // ============================================================
  // تصدير PDF (jsPDF)
  // ============================================================

  function toPDF() {
    if (typeof jsPDF === 'undefined') {
      alert('مكتبة jsPDF غير محملة — تحقق من الاتصال بالإنترنت'); return;
    }
    _getData(function(data) {
      var doc  = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
      var cols = data.headers;
      var rows = data.rows;

      doc.setFontSize(14);
      doc.text(data.title + ' — ' + CONFIG.todayStr(), 10, 15);

      if (typeof doc.autoTable === 'function') {
        doc.autoTable({ head: [cols], body: rows, startY: 20, styles: { font:'courier', fontSize:8 } });
      } else {
        // fallback بسيط بدون autoTable
        var y = 25;
        doc.setFontSize(8);
        rows.forEach(function(row) {
          if (y > 195) { doc.addPage(); y = 15; }
          doc.text(row.slice(0,6).join(' | '), 10, y);
          y += 6;
        });
      }

      doc.save(data.title + '_' + CONFIG.todayStr() + '.pdf');
    });
  }

  // ============================================================
  // طباعة
  // ============================================================

  function print() {
    _getData(function(data) {
      var win = window.open('', '_blank');
      var html = '<html dir="rtl"><head><meta charset="UTF-8">' +
        '<title>' + data.title + '</title>' +
        '<style>body{font-family:Arial,sans-serif;font-size:12px}' +
        'table{border-collapse:collapse;width:100%}' +
        'th{background:#0066B3;color:#fff;padding:6px;text-align:center}' +
        'td{border:1px solid #ccc;padding:5px;text-align:center}' +
        'h2{color:#0066B3}' +
        '@media print{button{display:none}}' +
        '</style></head><body>' +
        '<h2>' + data.title + ' — ' + CONFIG.todayStr() + '</h2>' +
        '<button onclick="window.print()">طباعة</button>' +
        '<table><thead><tr>' + data.headers.map(function(h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead>' +
        '<tbody>' + data.rows.map(function(row) {
          return '<tr>' + row.map(function(cell) { return '<td>' + (cell||'') + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table>' +
        '</body></html>';
      win.document.write(html);
      win.document.close();
      win.focus();
    });
  }

  // ============================================================
  // مساعدات
  // ============================================================

  function _groupByShift(empList, rows) {
    var map = {};
    empList.forEach(function(e, i) { var s = e.shift; (map[s] = map[s]||[]).push(rows[i]); });
    return map;
  }

  function _val(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function _leaveTypeLabel(key) {
    var t = CONFIG.LEAVE_TYPES.filter(function(l) { return l.key === key; })[0];
    return t ? t.label : (key||'—');
  }

  function _statusLabel(status) {
    var map = { pending_review:'قيد المراجعة', approved:'معتمد', rejected:'مرفوض' };
    return map[status] || status;
  }

  return { renderExportPanel, toExcel, toPDF, print };
})();
