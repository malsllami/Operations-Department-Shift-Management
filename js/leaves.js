// ============================================================
// إدارة الإجازات — قائمة وطلبات
// ============================================================

var Leaves = (function () {

  // ============================================================
  // قائمة طلبات الإجازات
  // ============================================================

  function renderList(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    var role = Auth.getEffectiveRole();

    API.getLeaveReqs().then(function(res) {
      if (!res.ok) { el.innerHTML = '<div class="empty-state">تعذّر التحميل</div>'; return; }

      var html = '<div class="list-filters">' +
        '<select id="leave-status-filter" class="filter-select">' +
          '<option value="">كل الحالات</option>' +
          '<option value="pending_review">قيد المراجعة</option>' +
          '<option value="approved">معتمد</option>' +
          '<option value="rejected">مرفوض</option>' +
        '</select>';

      if (role === 'موظف' || role === 'مشرف' || role === 'مدير') {
        html += '<button class="btn-add" onclick="App.navigate(\'leave-form\')">+ طلب إجازة</button>';
      }
      html += '</div>';

      // شريط التصدير
      if (role !== 'موظف') {
        var expShift = role === 'مشرف' ? Auth.getShift() : '';
        html += Export.inlineBar('leaves', expShift);
      }

      if (!res.data.length) {
        html += '<div class="empty-state">لا توجد طلبات إجازات</div>';
      } else {
        html += '<div class="req-list" id="leave-list">';
        res.data.forEach(function(req) { html += _leaveCard(req, role); });
        html += '</div>';
      }

      el.innerHTML = html;
      _bindLeaveFilter(res.data, role);
    });
  }

  function _leaveCard(req, role) {
    var statusMap = {
      pending_review: { label:'قيد المراجعة', bg:'#FFF9C4', text:'#F57F17' },
      approved:       { label:'معتمد',         bg:'#C8E6C9', text:'#1B5E20' },
      rejected:       { label:'مرفوض',         bg:'#FFCDD2', text:'#B71C1C' }
    };
    var st  = statusMap[req.status] || { label: req.status, bg:'#E0E0E0', text:'#424242' };
    var sk  = CONFIG.shiftKey(req.shift || '');
    var sc  = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;

    var canReview = (role === 'مدير' || role === 'مشرف') && req.status === 'pending_review';

    return '<div class="req-card" data-status="' + req.status + '" style="border-right:4px solid ' + sc.color + '">' +
      '<div class="req-card-header">' +
        '<span class="req-no">' + req.no + '</span>' +
        '<span class="req-status" style="background:' + st.bg + ';color:' + st.text + '">' + st.label + '</span>' +
      '</div>' +
      '<div class="req-card-body">' +
        '<div class="req-row"><span class="rr-label">الموظف</span><span>' + req.name + ' — وردية ' + (req.shift||'') + '</span></div>' +
        '<div class="req-row"><span class="rr-label">نوع الإجازة</span><span>' + _leaveTypeLabel(req.type) + '</span></div>' +
        '<div class="req-row"><span class="rr-label">الفترة</span><span>' + CONFIG.fmtDate(req.startDate) + ' → ' + CONFIG.fmtDate(req.endDate) + ' (' + req.days + ' أيام)</span></div>' +
        (req.empNotes ? '<div class="req-row"><span class="rr-label">ملاحظات</span><span>' + req.empNotes + '</span></div>' : '') +
        (req.revNotes ? '<div class="req-row"><span class="rr-label">ملاحظات المراجع</span><span>' + req.revNotes + '</span></div>' : '') +
        (req.reviewerName ? '<div class="req-row"><span class="rr-label">المراجع</span><span>' + req.reviewerName + ' (' + req.reviewerRole + ')</span></div>' : '') +
      '</div>' +
      (canReview ? _reviewButtons(req.no, 'leave') : '') +
    '</div>';
  }

  function _reviewButtons(no, type) {
    return '<div class="req-actions">' +
      '<button class="btn-sm btn-approve" onclick="' + type + 'Review(\'' + no + '\',\'approved\')">اعتماد</button>' +
      '<button class="btn-sm btn-reject"  onclick="' + type + 'ReviewReject(\'' + no + '\')">رفض</button>' +
    '</div>';
  }

  function _bindLeaveFilter(data, role) {
    var filter = document.getElementById('leave-status-filter');
    if (!filter) return;
    filter.onchange = function() {
      var val   = this.value;
      var cards = document.querySelectorAll('.req-card');
      cards.forEach(function(card) {
        card.style.display = (!val || card.dataset.status === val) ? '' : 'none';
      });
    };
  }

  // ============================================================
  // مراجعة الإجازة
  // ============================================================

  window.leaveReview = function(no, status) {
    API.reviewLeave(no, status, '').then(function(res) {
      if (res.ok) { App.toast('تمت المراجعة', 'success'); App.navigate('leaves'); }
      else App.toast('حدث خطأ: ' + res.error, 'error');
    });
  };

  window.leaveReviewReject = function(no) {
    _showNotesModal('سبب الرفض', function(notes) {
      API.reviewLeave(no, 'rejected', notes).then(function(res) {
        if (res.ok) { App.toast('تم رفض الطلب', 'success'); App.navigate('leaves'); }
        else App.toast('حدث خطأ: ' + res.error, 'error');
      });
    });
  };

  // ============================================================
  // نموذج طلب الإجازة
  // ============================================================

  function renderForm(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var user = Auth.getUser();
    var role = Auth.getEffectiveRole();

    var html = '<form id="leave-form" class="form-card" novalidate>';
    html += '<div class="form-grid">';

    if (role === 'موظف') {
      html += _staticField('الرقم الوظيفي', user.empId);
      html += _staticField('الاسم', user.name);
      html += _staticField('الوردية', 'وردية ' + user.shift);
    } else {
      html += '<div class="form-field"><label>الوردية</label><select id="lf-shift" class="form-select" onchange="Leaves._loadShiftEmployees(this.value)">' +
        ['أ','ب','ج','د'].map(function(s) {
          var sk = CONFIG.shiftKey(s);
          return '<option value="' + s + '" ' + (role === 'مشرف' && s !== user.shift ? 'disabled' : '') + '>وردية ' + CONFIG.SHIFTS[sk].label + '</option>';
        }).join('') +
      '</select></div>';
      html += '<div class="form-field"><label>الموظف</label><select id="lf-emp" class="form-select"><option value="">جارٍ التحميل...</option></select></div>';
    }

    // نوع الإجازة
    html += '<div class="form-field"><label>نوع الإجازة <span class="req">*</span></label><select id="lf-type" class="form-select" onchange="Leaves._typeChange(this)">';
    CONFIG.LEAVE_TYPES.forEach(function(t) {
      html += '<option value="' + t.key + '">' + t.label + '</option>';
    });
    html += '</select></div>';

    // رصيد الإجازة (يظهر إذا سنوية أو مجدولة)
    html += '<div id="lf-balance-wrap" class="form-field" style="display:none">' +
      '<label>الرصيد المتاح</label><div class="form-static" id="lf-balance-val">—</div>' +
    '</div>';

    html += '<div class="form-field"><label>تاريخ البداية <span class="req">*</span></label><input type="date" id="lf-start" class="form-input" required onchange="Leaves._calcDays()"></div>';
    html += '<div class="form-field"><label>تاريخ النهاية <span class="req">*</span></label><input type="date" id="lf-end"   class="form-input" required onchange="Leaves._calcDays()"></div>';
    html += '<div class="form-field"><label>مدة الإجازة</label><div class="form-static" id="lf-days">—</div></div>';

    html += '</div>'; // form-grid

    // تقويم مصغر
    html += '<div id="lf-mini-cal" class="mini-cal-container"></div>';

    // تحذير الرصيد
    html += '<div id="lf-warn" class="form-warning" style="display:none">⚠️ الرصيد غير كافٍ — سيتم إرسال الطلب وسيراجعه المشرف</div>';

    html += '<div class="form-field"><label>ملاحظات</label><textarea id="lf-notes" class="form-textarea" rows="3" placeholder="اختياري"></textarea></div>';

    html += '<div id="lf-error" class="form-error" style="display:none"></div>';
    html += '<div class="form-actions">' +
      '<button type="submit" class="btn-primary">إرسال الطلب</button>' +
      '<button type="button" class="btn-outline" onclick="App.goBack()">إلغاء</button>' +
    '</div>';
    html += '</form>';

    el.innerHTML = html;
    _bindLeaveForm(role, user);

    if (role !== 'موظف') {
      var defShift = role === 'مشرف' ? user.shift : 'أ';
      var shiftEl = document.getElementById('lf-shift');
      if (shiftEl) { shiftEl.value = defShift; Leaves._loadShiftEmployees(defShift); }
    }
  }

  var _leaveData = null;

  function _bindLeaveForm(role, user) {
    if (role === 'موظف') {
      API.getLeaves().then(function(res) {
        _leaveData = res.ok && res.data.length ? res.data[0] : null;
        Leaves._typeChange(document.getElementById('lf-type'));
      });
    }

    var form = document.getElementById('leave-form');
    if (!form) return;
    form.onsubmit = function(e) {
      e.preventDefault();
      var errEl = document.getElementById('lf-error');
      errEl.style.display = 'none';

      var startEl = document.getElementById('lf-start');
      var endEl   = document.getElementById('lf-end');
      var typeEl  = document.getElementById('lf-type');
      var daysEl  = document.getElementById('lf-days');
      var notesEl = document.getElementById('lf-notes');

      if (!startEl.value || !endEl.value) {
        errEl.textContent = 'يرجى تحديد تاريخ البداية والنهاية';
        errEl.style.display = 'block'; return;
      }

      var start = new Date(startEl.value);
      var end   = new Date(endEl.value);
      if (end < start) {
        errEl.textContent = 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية';
        errEl.style.display = 'block'; return;
      }

      var days = Math.round((end - start) / 86400000) + 1;
      var data = {
        leaveType:  typeEl.value,
        startDate:  startEl.value,
        endDate:    endEl.value,
        days:       String(days),
        notes:      notesEl ? notesEl.value : ''
      };

      if (role !== 'موظف') {
        var empEl = document.getElementById('lf-emp');
        var shEl  = document.getElementById('lf-shift');
        if (!empEl || !empEl.value) {
          errEl.textContent = 'يرجى اختيار الموظف';
          errEl.style.display = 'block'; return;
        }
        data.empId = empEl.value;
        data.shift = shEl ? shEl.value : '';
        var opt = empEl.options[empEl.selectedIndex];
        data.name = opt ? opt.text.split(' — ')[0] : '';
      }

      var btn = form.querySelector('[type=submit]');
      App.btnLoad(btn);

      API.submitLeave(data).then(function(res) {
        App.btnDone(btn);
        if (res.ok) {
          App.toast('تم إرسال طلب الإجازة: ' + res.no, 'success');
          App.navigate('leaves');
        } else {
          errEl.textContent = 'حدث خطأ: ' + res.error;
          errEl.style.display = 'block';
        }
      });
    };
  }

  function _loadShiftEmployees(shift) {
    var empEl = document.getElementById('lf-emp');
    if (!empEl) return;
    empEl.innerHTML = '<option value="">جارٍ التحميل...</option>';
    API.getEmployees().then(function(res) {
      if (!res.ok) { empEl.innerHTML = '<option>تعذّر التحميل</option>'; return; }
      empEl.innerHTML = '<option value="">اختر موظفاً...</option>';
      res.data.filter(function(e) { return e.shift === shift; }).forEach(function(emp) {
        var opt = document.createElement('option');
        opt.value = emp.empId;
        opt.textContent = emp.name + ' — ' + emp.empId;
        empEl.appendChild(opt);
      });
      // تحميل أرصدة الموظف المختار
      empEl.onchange = function() { _loadEmpLeaveBalance(this.value); };
    });
  }

  function _loadEmpLeaveBalance(empId) {
    if (!empId) { _leaveData = null; Leaves._typeChange(document.getElementById('lf-type')); return; }
    API.getLeaves(empId).then(function(res) {
      _leaveData = res.ok && res.data.length ? res.data[0] : null;
      Leaves._typeChange(document.getElementById('lf-type'));
    });
  }

  function _typeChange(select) {
    if (!select) return;
    var key  = select.value;
    var type = CONFIG.LEAVE_TYPES.filter(function(t) { return t.key === key; })[0];
    var wrap = document.getElementById('lf-balance-wrap');
    var valEl= document.getElementById('lf-balance-val');
    var warn = document.getElementById('lf-warn');

    if (type && type.hasBalance && _leaveData && wrap) {
      var bal = key === 'annual' ? _leaveData.annRem : _leaveData.schedRem;
      wrap.style.display = 'block';
      if (valEl) valEl.textContent = (bal !== undefined ? bal : '—') + ' يوم';
      if (warn) warn.style.display = (bal !== undefined && bal <= 0) ? 'block' : 'none';
    } else {
      if (wrap) wrap.style.display = 'none';
      if (warn) warn.style.display = 'none';
    }
  }

  function _calcDays() {
    var startEl = document.getElementById('lf-start');
    var endEl   = document.getElementById('lf-end');
    var daysEl  = document.getElementById('lf-days');
    if (!startEl || !endEl || !startEl.value || !endEl.value) return;

    var start = new Date(startEl.value);
    var end   = new Date(endEl.value);
    if (end < start) { if (daysEl) daysEl.textContent = 'تاريخ غير صحيح'; return; }

    var days = Math.round((end - start) / 86400000) + 1;
    if (daysEl) daysEl.textContent = days + ' ' + (days === 1 ? 'يوم' : 'أيام');

    // تحديث التقويم المصغر
    var user  = Auth.getUser();
    var shift = user ? user.shift : '';
    var shEl  = document.getElementById('lf-shift');
    if (shEl) shift = shEl.value;
    Calendar.renderMini('lf-mini-cal', startEl.value, endEl.value, shift);

    // تحقق الرصيد
    var typeEl = document.getElementById('lf-type');
    if (typeEl) _typeChange(typeEl);
  }

  // ============================================================
  // مساعدات
  // ============================================================

  function _leaveTypeLabel(key) {
    var t = CONFIG.LEAVE_TYPES.filter(function(l) { return l.key === key; })[0];
    return t ? t.label : (key || '—');
  }

  function _staticField(label, val) {
    return '<div class="form-field"><label>' + label + '</label><div class="form-static">' + (val||'—') + '</div></div>';
  }

  function _showNotesModal(placeholder, cb) {
    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-box">' +
      '<h3>ملاحظات الرفض</h3>' +
      '<textarea id="modal-notes" class="form-textarea" rows="3" placeholder="' + placeholder + '"></textarea>' +
      '<div class="form-actions">' +
        '<button class="btn-danger" id="modal-confirm">تأكيد الرفض</button>' +
        '<button class="btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">إلغاء</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(modal);
    modal.querySelector('#modal-confirm').onclick = function() {
      var notes = modal.querySelector('#modal-notes').value.trim();
      modal.remove();
      cb(notes);
    };
  }

  return {
    renderList, renderForm,
    _typeChange, _calcDays, _loadShiftEmployees
  };
})();
