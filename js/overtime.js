// ============================================================
// إدارة طلبات العمل الإضافي — 6 مراحل
// ============================================================

var Overtime = (function () {

  // ============================================================
  // قائمة الطلبات
  // ============================================================

  function renderList(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    var role = Auth.getEffectiveRole();

    API.getOvertimeReqs().then(function(res) {
      if (!res.ok) { el.innerHTML = '<div class="empty-state">تعذّر التحميل</div>'; return; }

      var html = '<div class="list-filters">' +
        '<select id="ot-status-filter" class="filter-select">' +
          '<option value="">كل الحالات</option>';

      Object.keys(CONFIG.OT_STATUS).forEach(function(k) {
        html += '<option value="' + k + '">' + CONFIG.OT_STATUS[k].label + '</option>';
      });
      html += '</select>';

      if (role !== 'اداري') {
        html += '<button class="btn-add" onclick="App.navigate(\'overtime-form\')">+ طلب عمل إضافي</button>';
      }
      html += '</div>';

      // شريط التصدير
      if (role !== 'موظف') {
        var expShift = role === 'مشرف' ? Auth.getShift() : '';
        html += Export.inlineBar('overtime', expShift);
      }

      if (!res.data.length) {
        html += '<div class="empty-state">لا توجد طلبات عمل إضافي</div>';
      } else {
        html += '<div class="req-list" id="ot-list">';
        res.data.forEach(function(req) { html += _otCard(req, role); });
        html += '</div>';
      }

      el.innerHTML = html;
      _bindFilter(res.data);
    });
  }

  function _otCard(req, role) {
    var stInfo = CONFIG.otStatusInfo(req.status);
    var sk     = CONFIG.shiftKey(req.shift || '');
    var sc     = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
    var user   = Auth.getUser();

    var actionsHtml = '';

    // أزرار بحسب الصلاحية والمرحلة
    if ((role === 'مدير' || role === 'مشرف') && req.status === 'created') {
      actionsHtml = '<div class="req-actions">' +
        '<button class="btn-sm btn-approve" onclick="Overtime._supervisorApprove(\'' + req.no + '\')">اعتماد</button>' +
        '<button class="btn-sm btn-reject"  onclick="Overtime._supervisorReject(\'' + req.no + '\')">رفض</button>' +
      '</div>';
    } else if ((role === 'مدير' || role === 'مشرف') && req.status === 'supervisor_approved') {
      actionsHtml = '<div class="req-actions">' +
        '<button class="btn-sm btn-primary" onclick="Overtime._sendToCoord(\'' + req.no + '\')">إرسال للتنسيق الإداري</button>' +
      '</div>';
    } else if ((role === 'مدير' || role === 'اداري') && req.status === 'sent_to_coordinator') {
      actionsHtml = '<div class="req-actions">' +
        '<button class="btn-sm btn-approve" onclick="Overtime._coordSendSystem(\'' + req.no + '\')">إرسال للنظام</button>' +
        '<button class="btn-sm btn-reject"  onclick="Overtime._coordReturn(\'' + req.no + '\')">إعادة للمشرف</button>' +
      '</div>';
    } else if (role === 'موظف' && req.status === 'sent_to_system' && String(req.empId) === String(user.empId)) {
      var received = req.receiptStatus === 'تم الاستلام';
      actionsHtml = '<div class="req-actions">' +
        '<button class="btn-sm ' + (received ? 'btn-disabled' : 'btn-approve') + '" ' +
          (received ? 'disabled' : 'onclick="Overtime._confirmReceipt(\'' + req.no + '\',true)"') + '>' +
          (received ? '✓ تم الاستلام' : 'تأكيد الاستلام') +
        '</button>' +
        (!received ? '<button class="btn-sm btn-outline" onclick="Overtime._confirmReceipt(\'' + req.no + '\',false)">لم يتم الاستلام</button>' : '') +
      '</div>';
    }

    return '<div class="req-card ot-card" data-status="' + req.status + '" style="border-right:4px solid ' + sc.color + '">' +
      '<div class="req-card-header">' +
        '<span class="req-no">' + req.no + '</span>' +
        '<span class="req-status" style="background:' + stInfo.bg + ';color:' + stInfo.text + '">' + stInfo.label + '</span>' +
      '</div>' +
      '<div class="req-card-body">' +
        '<div class="req-row"><span class="rr-label">الموظف</span><span>' + req.name + ' — وردية ' + (req.shift||'') + '</span></div>' +
        '<div class="req-row"><span class="rr-label">التاريخ</span><span>' + req.day + ' ' + CONFIG.fmtDate(req.date) + '</span></div>' +
        '<div class="req-row"><span class="rr-label">الساعات</span><span>' + req.hours + '</span></div>' +
        '<div class="req-row"><span class="rr-label">السبب</span><span>' + (req.reason||'—') + '</span></div>' +
        _stageRow('مراجعة المشرف', req.supRevDate, req.supReviewerName, req.supNotes) +
        _stageRow('التنسيق الإداري', req.coordSentDate, null, req.coordNotes) +
        _stageRow('الإرسال للنظام', req.systemSentDate, null, null) +
        (req.receiptStatus ? '<div class="req-row"><span class="rr-label">حالة الاستلام</span><span class="req-status" style="background:' + (req.receiptStatus==='تم الاستلام'?'#C8E6C9':'#E0E0E0') + ';color:' + (req.receiptStatus==='تم الاستلام'?'#1B5E20':'#424242') + '">' + req.receiptStatus + '</span></div>' : '') +
      '</div>' +
      actionsHtml +
    '</div>';
  }

  function _stageRow(label, date, name, notes) {
    if (!date) return '';
    var txt = CONFIG.fmtDate(date);
    if (name) txt += ' — ' + name;
    if (notes) txt += ' | ' + notes;
    return '<div class="req-row"><span class="rr-label">' + label + '</span><span class="rr-date">' + txt + '</span></div>';
  }

  function _bindFilter(data) {
    var filter = document.getElementById('ot-status-filter');
    if (!filter) return;
    filter.onchange = function() {
      var val   = this.value;
      var cards = document.querySelectorAll('.ot-card');
      cards.forEach(function(card) {
        card.style.display = (!val || card.dataset.status === val) ? '' : 'none';
      });
    };
  }

  // ============================================================
  // إجراءات المراحل
  // ============================================================

  function _supervisorApprove(no) {
    _notesModal('ملاحظات الاعتماد (اختياري)', function(notes) {
      API.reviewOvertime(no, 'approved', notes).then(function(res) {
        if (res.ok) { App.toast('تم اعتماد الطلب', 'success'); App.navigate('overtime'); }
        else App.toast('خطأ: ' + res.error, 'error');
      });
    }, true);
  }

  function _supervisorReject(no) {
    _notesModal('سبب الرفض', function(notes) {
      API.reviewOvertime(no, 'rejected', notes).then(function(res) {
        if (res.ok) { App.toast('تم رفض الطلب', 'success'); App.navigate('overtime'); }
        else App.toast('خطأ: ' + res.error, 'error');
      });
    });
  }

  function _sendToCoord(no) {
    if (!confirm('إرسال الطلب ' + no + ' للتنسيق الإداري؟')) return;
    API.sendToCoordinator(no).then(function(res) {
      if (res.ok) { App.toast('تم الإرسال للتنسيق الإداري', 'success'); App.navigate('overtime'); }
      else App.toast('خطأ: ' + res.error, 'error');
    });
  }

  function _coordSendSystem(no) {
    _notesModal('ملاحظات (اختياري)', function(notes) {
      API.coordinatorAction(no, 'send_system', notes).then(function(res) {
        if (res.ok) { App.toast('تم الإرسال للنظام', 'success'); App.navigate('overtime'); }
        else App.toast('خطأ: ' + res.error, 'error');
      });
    }, true);
  }

  function _coordReturn(no) {
    _notesModal('سبب الإعادة للمشرف', function(notes) {
      API.coordinatorAction(no, 'return_supervisor', notes).then(function(res) {
        if (res.ok) { App.toast('تم الإعادة للمشرف', 'success'); App.navigate('overtime'); }
        else App.toast('خطأ: ' + res.error, 'error');
      });
    });
  }

  function _confirmReceipt(no, received) {
    API.confirmReceipt(no, received).then(function(res) {
      if (res.ok) {
        App.toast(received ? 'تم تأكيد الاستلام' : 'تم تسجيل عدم الاستلام', 'success');
        App.navigate('overtime');
      } else App.toast('خطأ: ' + res.error, 'error');
    });
  }

  // ============================================================
  // نموذج طلب العمل الإضافي
  // ============================================================

  function renderForm(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var user = Auth.getUser();
    var role = Auth.getEffectiveRole();

    var html = '<form id="ot-form" class="form-card" novalidate>';
    html += '<div class="form-grid">';

    if (role === 'موظف') {
      html += _staticField('الرقم الوظيفي', user.empId);
      html += _staticField('الاسم', user.name);
      html += _staticField('الوردية', 'وردية ' + user.shift);
    } else {
      html += '<div class="form-field"><label>الوردية</label><select id="otf-shift" class="form-select" onchange="Overtime._loadShiftEmps(this.value);Overtime._updateDutyStatus()">' +
        ['أ','ب','ج','د'].map(function(s) {
          var sk = CONFIG.shiftKey(s);
          return '<option value="' + s + '" ' + (role==='مشرف' && s!==user.shift ? 'disabled':'') + '>وردية ' + CONFIG.SHIFTS[sk].label + '</option>';
        }).join('') +
      '</select></div>';
      html += '<div class="form-field"><label>الموظف</label><select id="otf-emp" class="form-select"><option value="">اختر موظفاً...</option></select></div>';
    }

    // التاريخ واليوم
    var today = CONFIG.todayStr();
    html += '<div class="form-field"><label>التاريخ <span class="req">*</span></label><input type="date" id="otf-date" class="form-input" value="' + today + '" required onchange="Overtime._updateDay(this)"></div>';
    html += '<div class="form-field"><label>اليوم</label><div class="form-static" id="otf-day">' + CONFIG.DAYS_AR[new Date().getDay()] + '</div></div>';

    html += '</div>'; // form-grid مؤقت

    // ---- بطاقة حالة الدوام ----
    html += '<div id="otf-status-card" class="ot-duty-card"></div>';

    html += '<div class="form-grid">'; // استئناف form-grid

    // عدد الساعات
    html += '<div class="form-field"><label>عدد ساعات العمل الإضافي <span class="req">*</span></label>' +
      '<input type="text" id="otf-hours" class="form-input" placeholder="مثال: 2 أو 1.5" required ' +
      'onblur="Overtime._normalizeHours(this)" inputmode="decimal"></div>';

    // السبب (إلزامي)
    html += '<div class="form-field form-field-full"><label>سبب العمل الإضافي <span class="req">*</span></label>' +
      '<textarea id="otf-reason" class="form-textarea" rows="3" required placeholder="اذكر سبب العمل الإضافي..."></textarea></div>';

    html += '</div>'; // form-grid

    html += '<div id="otf-error" class="form-error" style="display:none"></div>';
    html += '<div class="form-actions">' +
      '<button type="submit" class="btn-primary" id="otf-submit">إرسال الطلب</button>' +
      '<button type="button" class="btn-outline" onclick="App.goBack()">إلغاء</button>' +
    '</div>';
    html += '</form>';

    el.innerHTML = html;
    _bindOtForm(role, user);

    if (role !== 'موظف') {
      var defShift = role === 'مشرف' ? user.shift : 'أ';
      var shEl = document.getElementById('otf-shift');
      if (shEl) { shEl.value = defShift; Overtime._loadShiftEmps(defShift); }
    }

    // عرض حالة الدوام بمجرد فتح النموذج
    _updateDutyStatus();
  }

  var _submitting = false;

  function _bindOtForm(role, user) {
    var form = document.getElementById('ot-form');
    if (!form) return;
    form.onsubmit = function(e) {
      e.preventDefault();
      if (_submitting) return;

      var errEl  = document.getElementById('otf-error');
      errEl.style.display = 'none';

      var hours  = CONFIG.toLatinNums(document.getElementById('otf-hours').value.trim());
      var reason = (document.getElementById('otf-reason').value || '').trim();
      var date   = document.getElementById('otf-date').value;

      if (!hours || isNaN(parseFloat(hours)) || parseFloat(hours) <= 0) {
        errEl.textContent = 'يرجى إدخال عدد ساعات صحيح';
        errEl.style.display = 'block'; return;
      }
      if (!reason) {
        errEl.textContent = 'سبب العمل الإضافي إلزامي';
        errEl.style.display = 'block'; return;
      }

      var data = { hours: hours, reason: reason, date: date };

      if (role !== 'موظف') {
        var empEl = document.getElementById('otf-emp');
        var shEl  = document.getElementById('otf-shift');
        if (!empEl || !empEl.value) {
          errEl.textContent = 'يرجى اختيار الموظف';
          errEl.style.display = 'block'; return;
        }
        var opt  = empEl.options[empEl.selectedIndex];
        data.empId = empEl.value;
        data.shift = shEl ? shEl.value : '';
        data.name  = opt ? opt.text.split(' — ')[0] : '';
      }

      _submitting = true;
      var btn = document.getElementById('otf-submit');
      App.btnLoad(btn);

      API.submitOvertime(data).then(function(res) {
        _submitting = false;
        App.btnDone(btn);
        if (res.ok) {
          App.toast('تم إرسال الطلب: ' + res.no, 'success');
          App.navigate('overtime');
        } else {
          var errMap = { reason_required: 'سبب العمل الإضافي إلزامي' };
          errEl.textContent = errMap[res.error] || ('حدث خطأ: ' + res.error);
          errEl.style.display = 'block';
        }
      });
    };
  }

  function _loadShiftEmps(shift) {
    var empEl = document.getElementById('otf-emp');
    if (!empEl) return;
    empEl.innerHTML = '<option value="">جارٍ التحميل...</option>';
    API.getEmployees().then(function(res) {
      if (!res.ok) return;
      empEl.innerHTML = '<option value="">اختر موظفاً...</option>';
      res.data.filter(function(e) { return e.shift === shift; }).forEach(function(emp) {
        var opt = document.createElement('option');
        opt.value = emp.empId;
        opt.textContent = emp.name + ' — ' + emp.empId;
        empEl.appendChild(opt);
      });
    });
  }

  function _updateDay(input) {
    var dayEl = document.getElementById('otf-day');
    if (!dayEl || !input.value) return;
    var d = new Date(input.value);
    dayEl.textContent = CONFIG.DAYS_AR[d.getDay()] || '—';
    _updateDutyStatus();
  }

  function _updateDutyStatus() {
    var card = document.getElementById('otf-status-card');
    if (!card) return;

    var dateEl  = document.getElementById('otf-date');
    var shiftEl = document.getElementById('otf-shift');
    var user    = Auth.getUser();

    var date  = dateEl  ? dateEl.value  : CONFIG.todayStr();
    var shift = shiftEl ? shiftEl.value : (user ? user.shift : '');
    if (!shift || !date) { card.innerHTML = ''; return; }

    var sk    = CONFIG.shiftKey(shift);
    var sc    = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
    var st    = CONFIG.getShiftStatus(shift, date);
    var stc   = CONFIG.STATUS[st.en] || CONFIG.STATUS.off;

    // اسم اليوم من التاريخ
    var d     = new Date(date);
    var dayAr = CONFIG.DAYS_AR[d.getDay()] || '';
    var fDate = CONFIG.fmtDate(date);

    card.innerHTML =
      '<div class="ot-duty-inner" style="border-right: 4px solid ' + sc.color + '; background: linear-gradient(135deg,' + sc.color + '11 0%,' + sc.color + '06 100%)">' +
        '<div class="ot-duty-shift" style="background:' + sc.color + ';color:#fff">' +
          '<span class="ot-duty-shift-name">وردية ' + sc.label + '</span>' +
        '</div>' +
        '<div class="ot-duty-info">' +
          '<div class="ot-duty-row">' +
            '<span class="ot-duty-badge" style="background:' + stc.bg + ';color:' + stc.text + '">' +
              stc.icon + ' ' + stc.label +
            '</span>' +
            '<span class="ot-duty-date">' + dayAr + ' ' + fDate + '</span>' +
          '</div>' +
          '<div class="ot-duty-desc">حالة الوردية في يوم تقديم الطلب</div>' +
        '</div>' +
      '</div>';
  }

  function _normalizeHours(input) {
    var val = CONFIG.toLatinNums(input.value.replace(',', '.'));
    input.value = isNaN(parseFloat(val)) ? '' : String(parseFloat(val));
  }

  // ============================================================
  // مساعدات
  // ============================================================

  function _staticField(label, val) {
    return '<div class="form-field"><label>' + label + '</label><div class="form-static">' + (val||'—') + '</div></div>';
  }

  function _notesModal(placeholder, cb, optional) {
    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-box">' +
      '<h3>' + placeholder + '</h3>' +
      '<textarea id="modal-notes" class="form-textarea" rows="3" placeholder="' + placeholder + (optional ? ' (اختياري)' : '') + '"></textarea>' +
      '<div class="form-actions">' +
        '<button class="btn-primary" id="modal-ok">تأكيد</button>' +
        '<button class="btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">إلغاء</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(modal);
    modal.querySelector('#modal-ok').onclick = function() {
      var notes = modal.querySelector('#modal-notes').value.trim();
      if (!optional && !notes) { alert('يرجى إدخال الملاحظات'); return; }
      modal.remove();
      cb(notes);
    };
  }

  return {
    renderList, renderForm,
    _supervisorApprove, _supervisorReject, _sendToCoord,
    _coordSendSystem, _coordReturn, _confirmReceipt,
    _loadShiftEmps, _updateDay, _normalizeHours, _updateDutyStatus
  };
})();
