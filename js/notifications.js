// ============================================================
// الإشعارات — نظام المراحل المجمّعة (طلب واحد = بطاقة واحدة)
// ============================================================

var Notifications = (function () {

  // ترتيب مراحل الطلب
  var _STAGE_ORDER = {
    leave_submitted:    1,  overtime_submitted:    1,
    leave_request:      2,  overtime_request:      2,
    leave_review:       3,  overtime_review:       3,
    overtime_coord:     4,
    overtime_coord_result: 5
  };

  // ألوان ورموز الأنواع
  var _TC = {
    leave_submitted:       { icon:'🏖️', label:'تم إرسال الطلب',        bg:'#EFF6FF', tx:'#1D4ED8' },
    leave_request:         { icon:'🏖️', label:'طلب جديد',              bg:'#FFF8E1', tx:'#92400E' },
    leave_review:          { icon:'✅', label:null },
    overtime_submitted:    { icon:'⏱️', label:'تم إرسال الطلب',        bg:'#EFF6FF', tx:'#1D4ED8' },
    overtime_request:      { icon:'⏱️', label:'طلب جديد',              bg:'#FFF8E1', tx:'#92400E' },
    overtime_review:       { icon:'📋', label:null },
    overtime_coord:        { icon:'📤', label:'بانتظار التنسيق',        bg:'#F5F3FF', tx:'#5B21B6' },
    overtime_coord_result: { icon:'📨', label:null },
    transfer:              { icon:'🔀', label:'نقل وردية',              bg:'#FFF7ED', tx:'#C2410C' }
  };

  // استخراج حالة من نص الرسالة
  function _parseStatus(msg) {
    if (!msg) return null;
    if (msg.indexOf('تم الاعتماد') !== -1)           return { label:'✓ معتمد',            bg:'#D1FAE5', tx:'#065F46' };
    if (msg.indexOf('تم الرفض') !== -1 || msg.indexOf('رُفض') !== -1) return { label:'✗ مرفوض',  bg:'#FEE2E2', tx:'#991B1B' };
    if (msg.indexOf('أُعيد للمشرف') !== -1)           return { label:'↩ أُعيد للمشرف',   bg:'#FEF3C7', tx:'#92400E' };
    if (msg.indexOf('تم الإرسال للنظام') !== -1)      return { label:'↑ أُرسل للنظام',   bg:'#E0F2FE', tx:'#0369A1' };
    if (msg.indexOf('بانتظار المراجعة') !== -1)        return { label:'⏳ قيد المراجعة',   bg:'#EFF6FF', tx:'#1D4ED8' };
    if (msg.indexOf('اعتمده المشرف') !== -1)           return { label:'✓ اعتمده المشرف',  bg:'#D1FAE5', tx:'#065F46' };
    return null;
  }

  // هل البطاقة مكتملة (منتهية الإجراء)؟
  function _isGroupDone(notifications) {
    return notifications.some(function(n) {
      if (n.status === 'actioned') return true;
      if (n.type === 'overtime_coord_result') return true;
      if ((n.type === 'leave_review' || n.type === 'overtime_review') && n.msg &&
          (n.msg.indexOf('تم الاعتماد') !== -1 || n.msg.indexOf('تم الرفض') !== -1)) return true;
      return false;
    });
  }

  // ============================================================
  // عرض الإشعارات
  // ============================================================
  function render(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    API.getNotifications().then(function(res) {
      if (!res.ok) { el.innerHTML = '<div class="empty-state">تعذّر تحميل الإشعارات</div>'; return; }

      var data = res.data || [];

      // في وضع الموظف: أظهر فقط الإشعارات الموجهة لهم شخصياً
      if (!Auth.isAdminMode() && Auth.canElevate()) {
        var empTypes = ['leave_submitted','overtime_submitted','leave_review','overtime_review','transfer','overtime_coord_result'];
        data = data.filter(function(n) { return empTypes.indexOf(n.type) !== -1; });
      }

      if (!data.length) { el.innerHTML = '<div class="empty-state">لا توجد إشعارات</div>'; return; }

      // --- تجميع حسب رقم الطلب (ref) ---
      var groups  = {};
      var singles = [];

      data.forEach(function(n) {
        if (n.ref) {
          if (!groups[n.ref]) groups[n.ref] = [];
          groups[n.ref].push(n);
        } else {
          singles.push(n);
        }
      });

      var groupKeys = Object.keys(groups).sort(function(a, b) {
        var la = groups[a][groups[a].length-1].date;
        var lb = groups[b][groups[b].length-1].date;
        return la > lb ? -1 : 1;
      });

      // --- شريط الأدوات ---
      var html = '<div class="notif-toolbar">' +
        '<label class="notif-select-all-wrap">' +
          '<input type="checkbox" id="notif-check-all" onchange="Notifications._toggleSelectAll(this)">' +
          '<span>تحديد الكل</span>' +
        '</label>' +
        '<button class="btn-sm btn-danger" id="notif-del-selected" disabled ' +
          'onclick="Notifications._deleteSelected(\'' + containerId + '\')">🗑️ حذف المحدد <span id="notif-sel-count"></span></button>' +
        '<button class="btn-sm btn-outline" onclick="Notifications._deleteAll(\'' + containerId + '\')">🧹 مسح الكل</button>' +
      '</div>';

      html += '<div class="notif-list" id="notif-cards-list">';

      groupKeys.forEach(function(ref) {
        var nos = groups[ref].map(function(n) { return n.no; });
        html += _groupCard(ref, groups[ref], nos);
      });

      singles.forEach(function(n) {
        html += _singleCard(n, [n.no]);
      });

      html += '</div>';
      el.innerHTML = html;

      // ربط أحداث الاختيار
      el.querySelectorAll('.notif-item-check').forEach(function(cb) {
        cb.addEventListener('change', function() { _updateSelectionBar(); });
      });
    });
  }

  // ============================================================
  // بطاقة مجمّعة — طلب واحد بجميع مراحله
  // ============================================================
  function _groupCard(ref, notifications, nos) {
    var sorted = notifications.slice().sort(function(a, b) {
      var oa = _STAGE_ORDER[a.type] || 99;
      var ob = _STAGE_ORDER[b.type] || 99;
      if (oa !== ob) return oa - ob;
      return a.date < b.date ? -1 : 1;
    });

    var isDone    = _isGroupDone(notifications);
    var hasUnread = notifications.some(function(n) { return n.status === 'unread'; });
    var firstN    = sorted[0];
    var isLeave   = firstN && firstN.type.indexOf('leave') !== -1;
    var mainDest  = isLeave ? 'leaves' : 'overtime';
    var mainIcon  = isLeave ? '🏖️' : '⏱️';
    var mainTitle = isLeave ? 'طلب إجازة' : 'طلب عمل إضافي';
    var nosJson   = JSON.stringify(nos || notifications.map(function(n) { return n.no; }));
    var nosAttr   = nosJson.replace(/"/g, '&quot;');

    var html = '<div class="notif-group-card' + (isDone ? ' ngc-done' : '') + '" ' +
      'data-nos="' + nosAttr + '">' +

      '<div class="ngc-header">' +
        '<label class="notif-check-wrap" onclick="event.stopPropagation()">' +
          '<input type="checkbox" class="notif-item-check" data-nos="' + nosAttr + '">' +
        '</label>' +
        '<span class="ngc-type-icon" onclick="Notifications._openGroup(' + nosJson.replace(/"/g,"'") + ',\'' + mainDest + '\')" style="cursor:pointer">' + mainIcon + '</span>' +
        '<div class="ngc-header-info" onclick="Notifications._openGroup(' + nosJson.replace(/"/g,"'") + ',\'' + mainDest + '\')" style="cursor:pointer">' +
          '<span class="ngc-title">' + mainTitle + '</span>' +
          '<span class="ngc-ref">' + ref + '</span>' +
        '</div>' +
        (hasUnread ? '<span class="ngc-unread-dot"></span>' : (isDone ? '<span class="ngc-done-badge">✓ مكتمل</span>' : '')) +
      '</div>' +

      '<div class="ngc-timeline">';

    sorted.forEach(function(n, i) {
      var isLast = i === sorted.length - 1;
      html += _stageRow(n, isLast, isDone);
    });

    html += '</div></div>';
    return html;
  }

  // ============================================================
  // صف مرحلة واحدة داخل البطاقة
  // ============================================================
  function _stageRow(n, isLast, groupDone) {
    var tc = _TC[n.type] || { icon:'🔔', label: n.title, bg:'#F3F4F6', tx:'#374151' };
    var parsedSt = _parseStatus(n.msg);

    var pillHtml = '';
    if (parsedSt) {
      pillHtml = '<span class="stage-pill" style="background:' + parsedSt.bg + ';color:' + parsedSt.tx + '">' + parsedSt.label + '</span>';
    } else if (tc.label) {
      pillHtml = '<span class="stage-pill" style="background:' + (tc.bg||'#F3F4F6') + ';color:' + (tc.tx||'#374151') + '">' + tc.label + '</span>';
    }

    var dotClass = isLast && !groupDone ? 'stage-dot-active' : (groupDone ? 'stage-dot-done' : 'stage-dot-past');

    // اختصار الرسالة إذا تطابقت مع العنوان
    var msgHtml = (n.msg && n.msg !== n.title && n.msg.length > 5)
      ? '<div class="stage-msg">' + n.msg + '</div>' : '';

    return '<div class="notif-stage">' +
      '<div class="stage-line-col">' +
        '<div class="stage-dot ' + dotClass + '"></div>' +
        (!isLast ? '<div class="stage-connector"></div>' : '') +
      '</div>' +
      '<div class="stage-content">' +
        '<div class="stage-row">' +
          '<span class="stage-label">' + (n.title||'') + '</span>' +
          pillHtml +
        '</div>' +
        msgHtml +
        '<div class="stage-date">' + _fmtDate(n.date) + '</div>' +
      '</div>' +
    '</div>';
  }

  // ============================================================
  // بطاقة منفردة (بدون ref — مثل نقل الوردية)
  // ============================================================
  function _singleCard(n, nos) {
    var tc      = _TC[n.type] || { icon:'🔔', label:'إشعار', bg:'#F3F4F6', tx:'#374151' };
    var isDone  = n.status === 'actioned';
    var nosJson = JSON.stringify(nos || [n.no]);
    var nosAttr = nosJson.replace(/"/g, '&quot;');
    return '<div class="notif-group-card' + (isDone ? ' ngc-done' : '') + '" data-nos="' + nosAttr + '">' +
      '<div class="ngc-header">' +
        '<label class="notif-check-wrap" onclick="event.stopPropagation()">' +
          '<input type="checkbox" class="notif-item-check" data-nos="' + nosAttr + '">' +
        '</label>' +
        '<span class="ngc-type-icon" onclick="Notifications._readAndNav(\'' + n.no + '\',\'' + n.type + '\',\'' + n.status + '\',this.closest(\'.notif-group-card\'))" style="cursor:pointer">' + tc.icon + '</span>' +
        '<div class="ngc-header-info" onclick="Notifications._readAndNav(\'' + n.no + '\',\'' + n.type + '\',\'' + n.status + '\',this.closest(\'.notif-group-card\'))" style="cursor:pointer">' +
          '<span class="ngc-title">' + (n.title||'') + '</span>' +
        '</div>' +
        (n.status === 'unread' ? '<span class="ngc-unread-dot"></span>' : '') +
      '</div>' +
      '<div class="ngc-timeline">' +
        '<div class="notif-stage">' +
          '<div class="stage-line-col"><div class="stage-dot stage-dot-active"></div></div>' +
          '<div class="stage-content">' +
            '<div class="stage-msg">' + (n.msg||'') + '</div>' +
            '<div class="stage-date">' + _fmtDate(n.date) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ============================================================
  // النقر على المجموعة — تحديد كل الإشعارات كمقروءة
  // ============================================================
  function _openGroup(nos, dest) {
    if (!Array.isArray(nos)) nos = [nos];
    nos.forEach(function(no) { API.markNotifRead(no); });
    App.loadNotifBadge();
    App.navigate(dest);
  }

  function _readAndNav(no, type, status, el) {
    if (status === 'unread') {
      API.markNotifRead(no).then(function() { App.loadNotifBadge(); });
      if (el) { el.classList.remove('ngc-unread'); }
    }
    var navMap = {
      leave_request:'leaves', leave_submitted:'leaves', leave_review:'leaves',
      overtime_request:'overtime', overtime_submitted:'overtime',
      overtime_review:'overtime', overtime_coord:'overtime',
      overtime_coord_result:'overtime', transfer:'dashboard'
    };
    if (navMap[type]) App.navigate(navMap[type]);
  }

  // ============================================================
  // شارة عدد الإشعارات غير المقروءة
  // ============================================================
  function loadBadge(dotId) {
    API.getNotifications().then(function(res) {
      if (!res.ok) return;
      var data = res.data || [];

      // في وضع الموظف: عدّ فقط إشعاراته الخاصة
      if (!Auth.isAdminMode() && Auth.canElevate()) {
        var empTypes = ['leave_submitted','overtime_submitted','leave_review','overtime_review','transfer','overtime_coord_result'];
        data = data.filter(function(n) { return empTypes.indexOf(n.type) !== -1; });
      }

      // أنواع لا تُحسب في العداد (تأكيدات الإرسال الذاتية)
      var NO_BADGE = { 'leave_submitted': true, 'overtime_submitted': true };
      data = data.filter(function(n) { return !NO_BADGE[n.type]; });

      // عدّ مجموعات بها unread (وليس إشعارات فردية)
      var groups = {};
      var unreadCount = 0;
      data.forEach(function(n) {
        if (n.ref) {
          if (!groups[n.ref]) groups[n.ref] = false;
          if (n.status === 'unread') groups[n.ref] = true;
        } else if (n.status === 'unread') {
          unreadCount++;
        }
      });
      Object.keys(groups).forEach(function(ref) { if (groups[ref]) unreadCount++; });

      var dot = document.getElementById(dotId || 'notif-dot');
      if (dot) {
        dot.style.display = unreadCount > 0 ? 'flex' : 'none';
        dot.textContent   = unreadCount > 9 ? '9+' : (unreadCount || '');
      }
    });
  }

  // ============================================================
  // تحديد وحذف الإشعارات
  // ============================================================

  function _updateSelectionBar() {
    var all      = document.querySelectorAll('.notif-item-check');
    var selected = document.querySelectorAll('.notif-item-check:checked');
    var delBtn   = document.getElementById('notif-del-selected');
    var countEl  = document.getElementById('notif-sel-count');
    var checkAll = document.getElementById('notif-check-all');
    if (delBtn)   { delBtn.disabled = selected.length === 0; }
    if (countEl)  { countEl.textContent = selected.length > 0 ? '(' + selected.length + ')' : ''; }
    if (checkAll) { checkAll.indeterminate = selected.length > 0 && selected.length < all.length;
                    checkAll.checked = all.length > 0 && selected.length === all.length; }
  }

  function _toggleSelectAll(masterCb) {
    document.querySelectorAll('.notif-item-check').forEach(function(cb) {
      cb.checked = masterCb.checked;
    });
    _updateSelectionBar();
  }

  function _getSelectedNos() {
    var nos = [];
    document.querySelectorAll('.notif-item-check:checked').forEach(function(cb) {
      try {
        var arr = JSON.parse(cb.dataset.nos || '[]');
        arr.forEach(function(n) { if (nos.indexOf(n) === -1) nos.push(n); });
      } catch(e) {}
    });
    return nos;
  }

  function _getAllNos() {
    var nos = [];
    document.querySelectorAll('.notif-item-check').forEach(function(cb) {
      try {
        var arr = JSON.parse(cb.dataset.nos || '[]');
        arr.forEach(function(n) { if (nos.indexOf(n) === -1) nos.push(n); });
      } catch(e) {}
    });
    return nos;
  }

  function _deleteSelected(containerId) {
    var nos = _getSelectedNos();
    if (!nos.length) return;
    if (!confirm('حذف ' + nos.length + ' إشعار محدد؟')) return;
    _doDelete(nos, containerId);
  }

  function _deleteAll(containerId) {
    var nos = _getAllNos();
    if (!nos.length) return;
    if (!confirm('حذف جميع الإشعارات؟')) return;
    _doDelete(nos, containerId);
  }

  function _doDelete(nos, containerId) {
    API.deleteNotifs(nos).then(function(res) {
      if (res.ok) {
        App.toast('تم حذف الإشعارات ✓', 'success');
        App.loadNotifBadge();
        render(containerId);
      } else {
        App.toast('خطأ أثناء الحذف', 'error');
      }
    });
  }

  // ============================================================
  // مساعدات
  // ============================================================
  function _fmtDate(d) {
    if (!d) return '';
    var s = String(d);
    // إزالة T والـ Z من ISO dates
    return s.replace('T', ' ').replace(/\.000Z$/, '').replace(/Z$/, '');
  }

  return { render, loadBadge, _openGroup, _readAndNav,
           _toggleSelectAll, _deleteSelected, _deleteAll, _updateSelectionBar };
})();
