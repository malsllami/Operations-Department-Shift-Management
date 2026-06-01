// ============================================================
// إدارة طلبات العمل الإضافي — 6 مراحل
// ============================================================

var Overtime = (function () {

  var _cache   = {};    // req.no → req
  var _editReq = null;  // الطلب الحالي في وضع التعديل

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

      // الموظف يرى طلباته فقط
      var data = res.data;
      if (role === 'موظف') {
        var myId = String(Auth.getUser() ? Auth.getUser().empId : '');
        data = data.filter(function(req) { return String(req.empId) === myId; });
      }
      _cache = {};
      data.forEach(function(req) { _cache[req.no] = req; });

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

      // شريط التصدير — للمشرف والمدير والإداري فقط (الموظف يُصدِّر من لوحة التحكم)
      if (role !== 'موظف') {
        var expShift = role === 'مشرف' ? Auth.getShift() : '';
        html += Export.inlineBar('overtime', expShift);
      }

      if (!data.length) {
        html += '<div class="empty-state">لا توجد طلبات عمل إضافي</div>';
      } else {
        html += '<div class="req-list" id="ot-list">';
        data.forEach(function(req) { html += _otCard(req, role); });
        html += '</div>';
      }

      el.innerHTML = html;
      _bindFilter(data);
    });
  }

  function _otCard(req, role) {
    var stInfo = CONFIG.otStatusInfo(req.status);
    var sk     = CONFIG.shiftKey(req.shift || '');
    var sc     = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;
    var user   = Auth.getUser();

    var actionsHtml = '';
    var isMyReq = role === 'موظف' && String(req.empId) === String(user.empId);

    // أزرار المشرف / المدير
    if ((role === 'مدير' || role === 'مشرف') && req.status === 'تم الإنشاء') {
      actionsHtml = '<div class="req-actions">' +
        '<button class="btn-sm btn-approve" onclick="Overtime._supervisorApprove(\'' + req.no + '\')">اعتماد</button>' +
        '<button class="btn-sm btn-reject"  onclick="Overtime._supervisorReject(\'' + req.no + '\')">رفض</button>' +
      '</div>';
    } else if ((role === 'مدير' || role === 'مشرف') && req.status === 'معتمد من المشرف') {
      actionsHtml = '<div class="req-actions">' +
        '<button class="btn-sm btn-primary" onclick="Overtime._sendToCoord(\'' + req.no + '\')">إرسال للتنسيق الإداري</button>' +
      '</div>';
    } else if ((role === 'مدير' || role === 'اداري') && req.status === 'أُرسل للتنسيق الإداري') {
      actionsHtml = '<div class="req-actions">' +
        '<button class="btn-sm btn-approve" onclick="Overtime._coordSendSystem(\'' + req.no + '\')">إرسال للنظام</button>' +
        '<button class="btn-sm btn-reject"  onclick="Overtime._coordReturn(\'' + req.no + '\')">إعادة للمشرف</button>' +
      '</div>';
    // أزرار الموظف لطلبه الخاص
    } else if (isMyReq && req.status === 'تم الإرسال للنظام') {
      var received = req.receiptStatus === 'تم الاستلام';
      actionsHtml = '<div class="req-actions">' +
        '<button class="btn-sm ' + (received ? 'btn-disabled' : 'btn-approve') + '" ' +
          (received ? 'disabled' : 'onclick="Overtime._confirmReceipt(\'' + req.no + '\',true)"') + '>' +
          (received ? '✓ تم الاستلام' : 'تأكيد الاستلام') +
        '</button>' +
        (!received ? '<button class="btn-sm btn-outline" onclick="Overtime._confirmReceipt(\'' + req.no + '\',false)">لم يتم الاستلام</button>' : '') +
        '<button class="btn-sm btn-danger" onclick="Overtime._cancelOtReq(\'' + req.no + '\')" title="حذف الطلب">🗑️</button>' +
      '</div>';
    } else if (isMyReq && (req.status === 'تم الإنشاء' || req.status === 'قيد مراجعة المشرف')) {
      // لم يتم أي إجراء — تعديل + حذف
      actionsHtml = '<div class="req-actions">' +
        '<button class="btn-sm btn-edit" onclick="Overtime.editOtForm(\'' + req.no + '\')">✏️ تعديل</button>' +
        '<button class="btn-sm btn-danger" onclick="Overtime._cancelOtReq(\'' + req.no + '\')">🗑️ حذف</button>' +
      '</div>';
    } else if (isMyReq) {
      // تم إجراء — حذف فقط
      actionsHtml = '<div class="req-actions">' +
        '<button class="btn-sm btn-danger" onclick="Overtime._cancelOtReq(\'' + req.no + '\')">🗑️ حذف</button>' +
      '</div>';
    }

    // زر واتساب
    var otWaSection = '';
    if ((role === 'مدير' || role === 'مشرف' || role === 'اداري') && req.empPhone) {
      var waMsgOT = req.status === 'معتمد من المشرف'
        ? 'السلام عليكم ورحمة الله وبركاته\nصباح الخير/ مساء الخير\nتم اعتماد الوقت الإضافي وإرساله إلى التنسيق الإداري لمراجعته'
        : req.status === 'مرفوض'
          ? 'السلام عليكم ورحمة الله وبركاته\nصباح الخير/ مساء الخير\nتم رفض طلب الوقت الإضافي' + (req.supNotes ? '\n' + req.supNotes : '')
          : req.status === 'تم الإرسال للنظام'
            ? 'السلام عليكم ورحمة الله وبركاته\nصباح الخير/ مساء الخير\nتم مراجعة طلب ساعات عمل إضافي وتم إرسال الطلب في النظام'
            : 'بخصوص طلب العمل الإضافي رقم ' + req.no;
      otWaSection = '<div class="req-wa-row">' +
        '<a href="' + App.waLink(req.empPhone, waMsgOT) + '" target="_blank" class="btn-sm btn-wa">📱 واتساب الموظف</a>' +
      '</div>';
    } else if (isMyReq && req.status === 'تم الإنشاء') {
      var waMsgEmpOT = 'السلام عليكم ورحمة الله وبركاته 🙏\nأرسلت طلب عمل إضافي رقم ' + req.no + '\nأرجو المراجعة والاعتماد';
      otWaSection = '<div class="req-wa-row">' +
        '<button class="btn-sm btn-wa" onclick="Overtime._showShiftWaOT(\'' + (req.shift||'') + '\',\'' + waMsgEmpOT.replace(/\n/g,'\\n').replace(/'/g,"\\'") + '\')">📱 أبلغ المشرف</button>' +
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
      otWaSection +
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

    var user    = Auth.getUser();
    var role    = Auth.getEffectiveRole();
    var isEdit  = !!_editReq;
    var eReq    = _editReq || {};
    _editReq    = null;

    var html = '<form id="ot-form" class="form-card" novalidate>' +
      (isEdit ? '<div class="edit-mode-banner">✏️ وضع التعديل — الطلب ' + eReq.no + '</div>' : '');
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

    // ---- بطاقة حالة الدوام ليوم الطلب ----
    html += '<div id="otf-status-card" class="ot-duty-card"></div>';

    html += '<div class="form-grid">'; // استئناف form-grid

    // عدد الساعات
    html += '<div class="form-field"><label>عدد ساعات العمل الإضافي <span class="req">*</span></label>' +
      '<input type="text" id="otf-hours" class="form-input" placeholder="مثال: 2 أو 1.5" required ' +
      'onblur="Overtime._normalizeHours(this)" inputmode="decimal" value="' + (isEdit ? (eReq.hours||'') : '') + '"></div>';

    // الملاحظات / السبب (إلزامي)
    html += '<div class="form-field form-field-full"><label>الملاحظات / سبب العمل الإضافي <span class="req">*</span></label>' +
      '<textarea id="otf-reason" class="form-textarea" rows="3" required placeholder="اذكر سبب العمل الإضافي...">' +
      (isEdit ? (eReq.reason||'') : '') + '</textarea></div>';

    html += '</div>'; // form-grid

    html += '<div id="otf-error" class="form-error" style="display:none"></div>';
    html += '<div class="form-actions">' +
      '<button type="submit" class="btn-primary" id="otf-submit">' + (isEdit ? '💾 حفظ التعديل' : 'إرسال الطلب') + '</button>' +
      '<button type="button" class="btn-outline" onclick="App.goBack()">إلغاء</button>' +
    '</div>';
    html += '</form>';

    if (isEdit) el.dataset.editNo = eReq.no;
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
      var btn    = document.getElementById('otf-submit');
      var editNo = (document.getElementById('view-content') || {}).dataset && document.getElementById('view-content').dataset.editNo;
      var dayAr  = CONFIG.DAYS_AR[new Date(data.date).getDay()] || '';
      data.day   = dayAr;
      App.btnLoad(btn);

      var apiCall = editNo ? API.editOvertime(editNo, data) : API.submitOvertime(data);
      apiCall.then(function(res) {
        _submitting = false;
        App.btnDone(btn, null, res.ok ? 'success' : 'error');
        if (res.ok) {
          App.toast(editNo ? 'تم حفظ التعديل ✓' : 'تم إرسال الطلب: ' + (res.no||''), 'success');
          App.navigate('overtime');
          if (!editNo) {
            var shiftForWa = data.shift || (Auth.getUser() ? Auth.getUser().shift : '');
            var noForWa = res.no || '';
            API.getShiftContacts(shiftForWa).then(function(r) {
              if (r.ok && r.data.length) {
                App.showWaModal(r.data,
                  'السلام عليكم ورحمة الله وبركاته 🙏\nأرسلت طلب عمل إضافي رقم ' + noForWa + '\nأرجو المراجعة والاعتماد',
                  '📱 أبلغ المشرفين عبر واتساب');
              }
            });
          }
        } else {
          var errMap = { reason_required: 'الملاحظات / السبب إلزامي', cannot_edit_reviewed: 'لا يمكن تعديل طلب تمت مراجعته' };
          errEl.textContent = errMap[res.error] || ('حدث خطأ: ' + res.error);
          errEl.style.display = 'block';
        }
      });
    };
  }

  function _showShiftWaOT(shift, msg) {
    var realMsg = msg.replace(/\\n/g, '\n');
    API.getShiftContacts(shift).then(function(r) {
      App.showWaModal(r.ok ? r.data : [], realMsg, '📱 أبلغ المشرف عبر واتساب');
    });
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

  function editOtForm(no) {
    _editReq = _cache[no] || null;
    if (!_editReq) { App.toast('بيانات الطلب غير متوفرة', 'error'); return; }
    App.navigate('overtime-form');
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
    var hd    = Hijri.fromDate(d);
    var hijriStr = hd.day + ' ' + CONFIG.HIJRI_MONTHS[hd.month - 1] + ' ' + hd.year + ' هـ';

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
            '<div class="ot-duty-dates">' +
              '<span class="ot-duty-date">' + dayAr + ' ' + fDate + '</span>' +
              '<span class="ot-duty-hijri">' + hijriStr + '</span>' +
            '</div>' +
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
  // تعديل / حذف طلب الأوفرتايم (للموظف — قبل المراجعة)
  // ============================================================

  function _cancelOtReq(no) {
    if (!confirm('هل تريد حذف الطلب ' + no + '؟')) return;
    API.cancelOvertime(no).then(function(res) {
      if (res.ok) { App.toast('تم حذف الطلب', 'success'); App.navigate('overtime'); }
      else {
        var em = { cannot_cancel_reviewed:'لا يمكن حذف طلب تمت مراجعته', not_found:'الطلب غير موجود' };
        App.toast(em[res.error] || res.error, 'error');
      }
    });
  }

  function _editOtReq(no, hours, reason, date) {
    var initDay = date ? (CONFIG.DAYS_AR[new Date(date).getDay()] || '') : '';
    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML =
      '<div class="modal-box">' +
        '<h3>تعديل الطلب ' + no + '</h3>' +
        '<div class="form-field"><label>التاريخ <span class="req">*</span></label>' +
          '<input type="date" id="eot-date" class="form-input" value="' + (date||CONFIG.todayStr()) + '" ' +
          'onchange="document.getElementById(\'eot-day\').textContent=CONFIG.DAYS_AR[new Date(this.value).getDay()]||\'\'"></div>' +
        '<div class="form-field"><label>اليوم</label>' +
          '<div class="form-static" id="eot-day">' + initDay + '</div></div>' +
        '<div class="form-field"><label>عدد الساعات <span class="req">*</span></label>' +
          '<input type="text" id="eot-hours" class="form-input" value="' + (hours||'') + '" ' +
          'placeholder="مثال: 2 أو 1.5" inputmode="decimal"></div>' +
        '<div class="form-field"><label>الملاحظات / السبب <span class="req">*</span></label>' +
          '<textarea id="eot-reason" class="form-textarea" rows="3">' + (reason||'') + '</textarea></div>' +
        '<div id="eot-err" class="form-error" style="display:none"></div>' +
        '<div class="form-actions">' +
          '<button class="btn-primary" id="eot-save">💾 حفظ التعديل</button>' +
          '<button class="btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">إلغاء</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.querySelector('#eot-save').onclick = function() {
      var d = modal.querySelector('#eot-date').value;
      var h = parseFloat(CONFIG.toLatinNums(modal.querySelector('#eot-hours').value.replace(',','.'))) || 0;
      var r = modal.querySelector('#eot-reason').value.trim();
      var errEl = modal.querySelector('#eot-err');
      var btn = this;
      if (!d) { errEl.textContent = 'يرجى تحديد التاريخ'; errEl.style.display = 'block'; return; }
      if (h <= 0) { errEl.textContent = 'يرجى إدخال عدد ساعات صحيح'; errEl.style.display = 'block'; return; }
      if (!r) { errEl.textContent = 'الملاحظات / السبب مطلوب'; errEl.style.display = 'block'; return; }
      var dayAr = CONFIG.DAYS_AR[new Date(d).getDay()] || '';
      App.btnLoad(btn);
      API.editOvertime(no, { date:d, day:dayAr, hours:String(h), reason:r }).then(function(res) {
        App.btnDone(btn, null, res.ok ? 'success' : 'error');
        if (res.ok) {
          setTimeout(function() { modal.remove(); App.toast('تم تعديل الطلب ✓', 'success'); App.navigate('overtime'); }, 900);
        } else {
          errEl.textContent = res.error; errEl.style.display = 'block';
        }
      });
    };
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
    _loadShiftEmps, _updateDay, _normalizeHours, _updateDutyStatus, editOtForm,
    _cancelOtReq, _editOtReq, _showShiftWaOT
  };
})();
