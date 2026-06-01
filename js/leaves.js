// ============================================================
// إدارة الإجازات — قائمة وطلبات
// ============================================================

var Leaves = (function () {

  var _cache = {};      // req.no → req (لفتح نموذج التعديل)
  var _editReq = null;  // الطلب الحالي في وضع التعديل

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

      // الموظف يرى طلباته فقط
      var data = res.data;
      if (role === 'موظف') {
        var myId = String(Auth.getUser() ? Auth.getUser().empId : '');
        data = data.filter(function(req) { return String(req.empId) === myId; });
      }
      // تخزين للوصول السريع عند التعديل
      _cache = {};
      data.forEach(function(req) { _cache[req.no] = req; });

      var html = '<div class="list-filters">' +
        '<select id="leave-status-filter" class="filter-select">' +
          '<option value="">كل الحالات</option>' +
          '<option value="قيد المراجعة">قيد المراجعة</option>' +
          '<option value="معتمد">معتمد</option>' +
          '<option value="مرفوض">مرفوض</option>' +
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

      if (!data.length) {
        html += '<div class="empty-state">لا توجد طلبات إجازات</div>';
      } else {
        html += '<div class="req-list" id="leave-list">';
        data.forEach(function(req) { html += _leaveCard(req, role); });
        html += '</div>';
      }

      el.innerHTML = html;
      _bindLeaveFilter(data, role);
    });
  }

  function _leaveCard(req, role) {
    var statusMap = {
      'قيد المراجعة': { label:'قيد المراجعة', bg:'#FFF9C4', text:'#F57F17' },
      'معتمد':        { label:'معتمد',         bg:'#C8E6C9', text:'#1B5E20' },
      'مرفوض':        { label:'مرفوض',         bg:'#FFCDD2', text:'#B71C1C' }
    };
    var st  = statusMap[req.status] || { label: req.status, bg:'#E0E0E0', text:'#424242' };
    var sk  = CONFIG.shiftKey(req.shift || '');
    var sc  = CONFIG.SHIFTS[sk] || CONFIG.SHIFTS.a;

    var canReview  = (role === 'مدير' || role === 'مشرف') && req.status === 'قيد المراجعة';
    var canModify  = role === 'موظف' && req.status === 'قيد المراجعة';
    var canDelete  = role === 'موظف' && !canModify;

    // أزرار واتساب
    var waSection = '';
    if ((role === 'مدير' || role === 'مشرف') && req.empPhone) {
      // المشرف/المدير: زر لمراسلة الموظف — الرسالة تعتمد على الحالة
      var waMsgSup = req.status === 'معتمد'
        ? 'السلام عليكم ورحمة الله وبركاته\nصباح الخير/ مساء الخير\nتم اعتماد الإجازة ✅\nونتمنى لك إجازة سعيدة'
        : req.status === 'مرفوض'
          ? 'السلام عليكم ورحمة الله وبركاته\nصباح الخير/ مساء الخير\nنأسف لكم بأن طلب الإجازة تم رفضه بعد المراجعة' + (req.revNotes ? '\n' + req.revNotes : '')
          : 'بخصوص طلب الإجازة رقم ' + req.no;
      waSection = '<div class="req-wa-row">' +
        '<a href="' + App.waLink(req.empPhone, waMsgSup) + '" target="_blank" class="btn-sm btn-wa">📱 واتساب الموظف</a>' +
      '</div>';
    } else if (role === 'موظف' && req.status === 'قيد المراجعة') {
      // الموظف: زر لمراسلة مشرف الوردية
      var waMsgEmp = 'السلام عليكم ورحمة الله وبركاته 🙏\nأرسلت طلب إجازة رقم ' + req.no + '\nأرجو المراجعة والاعتماد';
      waSection = '<div class="req-wa-row">' +
        '<button class="btn-sm btn-wa" onclick="Leaves._showShiftWa(\'' + (req.shift||'') + '\',\'' + waMsgEmp.replace(/\n/g,'\\n').replace(/'/g,"\\'") + '\')">📱 أبلغ المشرف</button>' +
      '</div>';
    }

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
      waSection +
      (canReview ? _reviewButtons(req.no, 'leave') : '') +
      (canModify
        ? '<div class="req-actions">' +
            '<button class="btn-sm btn-edit" onclick="Leaves.editLeaveForm(\'' + req.no + '\')">✏️ تعديل</button>' +
            '<button class="btn-sm btn-danger" onclick="Leaves.cancelLeaveReq(\'' + req.no + '\')">🗑️ حذف</button>' +
          '</div>'
        : (canDelete
            ? '<div class="req-actions">' +
                '<button class="btn-sm btn-danger" onclick="Leaves.cancelLeaveReq(\'' + req.no + '\')">🗑️ حذف</button>' +
              '</div>'
            : '')) +
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
  // تعديل / حذف طلب الإجازة (للموظف — قيد المراجعة فقط)
  // ============================================================

  function editLeaveForm(no) {
    _editReq = _cache[no] || null;
    if (!_editReq) { App.toast('بيانات الطلب غير متوفرة', 'error'); return; }
    App.navigate('leave-form');
  }

  function cancelLeaveReq(no) {
    if (!confirm('هل تريد حذف الطلب ' + no + '؟')) return;
    API.cancelLeave(no).then(function(res) {
      if (res.ok) { App.toast('تم حذف الطلب', 'success'); App.navigate('leaves'); }
      else {
        var em = { cannot_cancel_reviewed:'لا يمكن حذف طلب تمت مراجعته', not_found:'الطلب غير موجود' };
        App.toast(em[res.error] || res.error, 'error');
      }
    });
  }

  function editLeaveReq(no, startDate, endDate, notes, leaveType) {
    var typeOpts = CONFIG.LEAVE_TYPES.map(function(t) {
      return '<option value="' + t.key + '"' + (t.key === leaveType ? ' selected' : '') + '>' + t.label + '</option>';
    }).join('');

    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML =
      '<div class="modal-box">' +
        '<h3>تعديل الطلب ' + no + '</h3>' +
        '<div class="form-field"><label>نوع الإجازة</label>' +
          '<select id="elr-type" class="form-select">' + typeOpts + '</select></div>' +
        '<div class="form-field"><label>من تاريخ</label>' +
          '<input type="date" id="elr-start" class="form-input" value="' + (startDate||'') + '"></div>' +
        '<div class="form-field"><label>إلى تاريخ</label>' +
          '<input type="date" id="elr-end" class="form-input" value="' + (endDate||'') + '"></div>' +
        '<div class="form-field"><label>ملاحظات</label>' +
          '<textarea id="elr-notes" class="form-textarea" rows="3">' + (notes||'') + '</textarea></div>' +
        '<div id="elr-err" class="form-error" style="display:none"></div>' +
        '<div class="form-actions">' +
          '<button class="btn-primary" id="elr-save">💾 حفظ التعديل</button>' +
          '<button class="btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">إلغاء</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.querySelector('#elr-save').onclick = function() {
      var s  = modal.querySelector('#elr-start').value;
      var e  = modal.querySelector('#elr-end').value;
      var n  = modal.querySelector('#elr-notes').value.trim();
      var tp = modal.querySelector('#elr-type').value;
      var errEl = modal.querySelector('#elr-err');
      var btn = this;
      if (!s || !e || s > e) {
        errEl.textContent = 'التواريخ غير صحيحة'; errEl.style.display = 'block'; return;
      }
      var days = Math.round((new Date(e) - new Date(s)) / 86400000) + 1;
      App.btnLoad(btn);
      API.editLeave(no, { leaveType:tp, startDate:s, endDate:e, days:days, notes:n }).then(function(res) {
        App.btnDone(btn, null, res.ok ? 'success' : 'error');
        if (res.ok) {
          setTimeout(function() { modal.remove(); App.toast('تم تعديل الطلب ✓', 'success'); App.navigate('leaves'); }, 900);
        } else {
          errEl.textContent = res.error; errEl.style.display = 'block';
        }
      });
    };
  }

  // ============================================================
  // نموذج طلب الإجازة
  // ============================================================

  function renderForm(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var user    = Auth.getUser();
    var role    = Auth.getEffectiveRole();
    var isEdit  = !!_editReq;
    var eReq    = _editReq || {};
    _editReq    = null;  // امسح بعد القراءة

    var html = '<form id="leave-form" class="form-card" novalidate>' +
      (isEdit ? '<div class="edit-mode-banner">✏️ وضع التعديل — الطلب ' + eReq.no + '</div>' : '');
    html += '<div class="form-grid">';

    if (role === 'موظف') {
      html += _staticField('الرقم الوظيفي', user.empId);
      html += _staticField('الاسم', user.name);
      html += _staticField('الوردية', 'وردية ' + user.shift);
      html += '<div class="form-field"><label>المنطقة</label><div class="form-static" id="lf-region">جارٍ التحميل…</div></div>';
      html += '<div class="form-field"><label>المركز</label><div class="form-static" id="lf-center">جارٍ التحميل…</div></div>';
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
      html += '<option value="' + t.key + '"' + (isEdit && t.key === eReq.type ? ' selected' : '') + '>' + t.label + '</option>';
    });
    html += '</select></div>';

    // رصيد الإجازة (يظهر إذا سنوية أو مجدولة)
    html += '<div id="lf-balance-wrap" class="form-field" style="display:none">' +
      '<label>الرصيد المتاح</label><div class="form-static" id="lf-balance-val">—</div>' +
    '</div>';

    html += '<div class="form-field"><label>تاريخ البداية <span class="req">*</span></label>' +
      '<input type="date" id="lf-start" class="form-input" required onchange="Leaves._calcDays()" value="' + (isEdit ? (eReq.startDate||'') : '') + '"></div>';
    html += '<div class="form-field"><label>تاريخ النهاية <span class="req">*</span></label>' +
      '<input type="date" id="lf-end" class="form-input" required onchange="Leaves._calcDays()" value="' + (isEdit ? (eReq.endDate||'') : '') + '"></div>';
    html += '<div class="form-field"><label>مدة الإجازة</label><div class="form-static" id="lf-days">—</div></div>';

    html += '</div>'; // form-grid

    // تقويم مصغر
    html += '<div id="lf-mini-cal" class="mini-cal-container"></div>';

    // تحذير الرصيد
    html += '<div id="lf-warn" class="form-warning" style="display:none">⚠️ الرصيد غير كافٍ — سيتم إرسال الطلب وسيراجعه المشرف</div>';

    html += '<div class="form-field"><label>ملاحظات</label>' +
      '<textarea id="lf-notes" class="form-textarea" rows="3" placeholder="اختياري">' + (isEdit ? (eReq.empNotes||'') : '') + '</textarea></div>';

    html += '<div id="lf-error" class="form-error" style="display:none"></div>';
    html += '<div class="form-actions">' +
      '<button type="submit" class="btn-primary">' + (isEdit ? '💾 حفظ التعديل' : 'إرسال الطلب') + '</button>' +
      '<button type="button" class="btn-outline" onclick="App.goBack()">إلغاء</button>' +
    '</div>';
    html += '</form>';

    // حفظ رقم الطلب في حالة التعديل
    if (isEdit) el.dataset.editNo = eReq.no;

    el.innerHTML = html;
    _bindLeaveForm(role, user);

    if (role !== 'موظف') {
      var defShift = role === 'مشرف' ? user.shift : 'أ';
      var shiftEl = document.getElementById('lf-shift');
      if (shiftEl) { shiftEl.value = defShift; Leaves._loadShiftEmployees(defShift); }
    }

    // جلب المنطقة والمركز للموظف تلقائياً
    if (role === 'موظف') {
      API.getRegions().then(function(res) {
        var rEl = document.getElementById('lf-region');
        var cEl = document.getElementById('lf-center');
        if (!rEl || !cEl) return;
        var rg = res.ok && res.data.length ? res.data[0] : null;
        rEl.textContent = rg ? (rg.region || '—') : '—';
        cEl.textContent = rg ? (rg.center || '—') : '—';
      });
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

      var btn    = form.querySelector('[type=submit]');
      var editNo = form.closest('[data-edit-no]') ? form.closest('[data-edit-no]').dataset.editNo
                  : (document.getElementById('view-content') ? document.getElementById('view-content').dataset.editNo : '');
      App.btnLoad(btn);

      var apiCall = editNo
        ? API.editLeave(editNo, data)
        : API.submitLeave(data);

      apiCall.then(function(res) {
        App.btnDone(btn, null, res.ok ? 'success' : 'error');
        if (res.ok) {
          App.toast(editNo ? 'تم حفظ التعديل ✓' : 'تم إرسال طلب الإجازة: ' + (res.no||''), 'success');
          App.navigate('leaves');
          // عرض نافذة واتساب للمشرفين (عند إرسال طلب جديد فقط)
          if (!editNo) {
            var shiftForWa = data.shift || (Auth.getUser() ? Auth.getUser().shift : '');
            var noForWa = res.no || '';
            API.getShiftContacts(shiftForWa).then(function(r) {
              if (r.ok && r.data.length) {
                App.showWaModal(r.data,
                  'السلام عليكم ورحمة الله وبركاته 🙏\nأرسلت طلب إجازة رقم ' + noForWa + '\nأرجو المراجعة والاعتماد',
                  '📱 أبلغ المشرفين عبر واتساب');
              }
            });
          }
        } else {
          var errs = { cannot_edit_reviewed:'لا يمكن تعديل طلب تمت مراجعته' };
          errEl.textContent = errs[res.error] || 'حدث خطأ: ' + res.error;
          errEl.style.display = 'block';
        }
      });
    };
  }

  function _showShiftWa(shift, msg) {
    var realMsg = msg.replace(/\\n/g, '\n');
    API.getShiftContacts(shift).then(function(r) {
      App.showWaModal(r.ok ? r.data : [], realMsg, '📱 أبلغ المشرف عبر واتساب');
    });
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
      var bal = key === 'سنوية' ? _leaveData.annRem : _leaveData.schedRem;
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
    _typeChange, _calcDays, _loadShiftEmployees, _showShiftWa,
    cancelLeaveReq, editLeaveReq, editLeaveForm
  };
})();
