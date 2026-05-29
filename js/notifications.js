// ============================================================
// الإشعارات
// ============================================================

var Notifications = (function () {

  // ألوان ورموز أنواع الإشعارات
  var _TC = {
    leave_request:         { border:'#F59E0B', icon:'🏖️', statusLabel:'طلب جديد',      statusBg:'#FFF8E1', statusTx:'#92400E' },
    leave_submitted:       { border:'#3B82F6', icon:'🏖️', statusLabel:'قيد المراجعة',  statusBg:'#EFF6FF', statusTx:'#1D4ED8' },
    leave_review:          { border:'#10B981', icon:'✅', statusLabel:null,             statusBg:null,      statusTx:null      },
    overtime_request:      { border:'#6366F1', icon:'⏱️', statusLabel:'طلب جديد',      statusBg:'#EEF2FF', statusTx:'#3730A3' },
    overtime_submitted:    { border:'#3B82F6', icon:'⏱️', statusLabel:'قيد المراجعة',  statusBg:'#EFF6FF', statusTx:'#1D4ED8' },
    overtime_review:       { border:'#3B82F6', icon:'📋', statusLabel:null,             statusBg:null,      statusTx:null      },
    overtime_coord:        { border:'#8B5CF6', icon:'📤', statusLabel:'للتنسيق الإداري',statusBg:'#F5F3FF', statusTx:'#5B21B6' },
    overtime_coord_result: { border:'#EC4899', icon:'📨', statusLabel:null,             statusBg:null,      statusTx:null      },
    transfer:              { border:'#F97316', icon:'🔀', statusLabel:'نقل وردية',      statusBg:'#FFF7ED', statusTx:'#C2410C' }
  };

  // استخراج حالة الطلب من محتوى الرسالة
  function _parseStatus(msg) {
    if (!msg) return null;
    if (msg.indexOf('تم الاعتماد') !== -1 || msg.indexOf('معتمد') !== -1)
      return { label:'معتمد ✓',         bg:'#D1FAE5', tx:'#065F46' };
    if (msg.indexOf('تم الرفض') !== -1 || msg.indexOf('مرفوض') !== -1 || msg.indexOf('رُفض') !== -1)
      return { label:'مرفوض ✗',         bg:'#FEE2E2', tx:'#991B1B' };
    if (msg.indexOf('أُعيد للمشرف') !== -1)
      return { label:'أُعيد للمشرف',    bg:'#FEF3C7', tx:'#92400E' };
    if (msg.indexOf('تم الإرسال للنظام') !== -1)
      return { label:'أُرسل للنظام',    bg:'#E0F2FE', tx:'#0369A1' };
    if (msg.indexOf('بانتظار المراجعة') !== -1)
      return { label:'قيد المراجعة',    bg:'#EFF6FF', tx:'#1D4ED8' };
    return null;
  }

  function render(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    API.getNotifications().then(function(res) {
      if (!res.ok) { el.innerHTML = '<div class="empty-state">تعذّر تحميل الإشعارات</div>'; return; }

      var data = res.data || [];

      // في وضع الموظف: أظهر فقط الإشعارات الموجهة لهم شخصياً (ليس إشعارات الوردية)
      if (!Auth.isAdminMode() && Auth.canElevate()) {
        var myId = String(Auth.getUser() ? Auth.getUser().empId : '');
        var ownTypes = ['leave_submitted','overtime_submitted','leave_review','overtime_review','transfer','overtime_coord_result'];
        data = data.filter(function(n) {
          return ownTypes.indexOf(n.type) !== -1;
        });
      }

      if (!data.length) {
        el.innerHTML = '<div class="empty-state">لا توجد إشعارات</div>'; return;
      }

      el.innerHTML = '<div class="notif-list">' +
        data.map(function(n) { return _notifItem(n); }).join('') +
      '</div>';
    });
  }

  function _notifItem(n) {
    var isDone = n.status === 'actioned';
    var tc     = _TC[n.type] || { border:'#9CA3AF', icon:'🔔', statusLabel:'إشعار', statusBg:'#F3F4F6', statusTx:'#374151' };

    // تحديد شارة الحالة
    var parsedStatus = _parseStatus(n.msg);
    var statusBg, statusTx, statusLabel;
    if (parsedStatus) {
      statusBg    = parsedStatus.bg;
      statusTx    = parsedStatus.tx;
      statusLabel = parsedStatus.label;
    } else if (tc.statusLabel) {
      statusBg    = tc.statusBg || '#F3F4F6';
      statusTx    = tc.statusTx || '#374151';
      statusLabel = tc.statusLabel;
    }

    var statusPill = statusLabel
      ? '<span class="notif-status-pill" style="background:' + statusBg + ';color:' + statusTx + '">' + statusLabel + '</span>'
      : '';

    var unreadDot = (n.status === 'unread')
      ? '<span class="notif-unread-dot"></span>'
      : '';

    return '<div class="notif-item ' + (isDone ? 'notif-done' : n.status === 'unread' ? 'notif-unread' : 'notif-read') + '" ' +
      'style="border-right:4px solid ' + tc.border + '" ' +
      'onclick="Notifications._readAndNav(\'' + n.no + '\',\'' + n.type + '\',\'' + n.status + '\',this)">' +
      '<div class="notif-icon">' + tc.icon + '</div>' +
      '<div class="notif-body">' +
        '<div class="notif-title-row">' +
          '<span class="notif-title">' + (n.title||'') + '</span>' +
          unreadDot +
          statusPill +
        '</div>' +
        '<div class="notif-msg">' + (n.msg||'') + '</div>' +
        '<div class="notif-meta">' +
          '<span class="notif-date">' + (n.date||'') + '</span>' +
          (n.ref ? '<span class="notif-ref">' + n.ref + '</span>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function _readAndNav(no, type, status, el) {
    if (status === 'unread') {
      API.markNotifRead(no).then(function() { App.loadNotifBadge(); });
      el.classList.remove('notif-unread');
      el.classList.add('notif-read');
      var dot = el.querySelector('.notif-unread-dot');
      if (dot) dot.remove();
    }

    var navMap = {
      leave_request: 'leaves', leave_submitted: 'leaves', leave_review: 'leaves',
      overtime_request: 'overtime', overtime_submitted: 'overtime',
      overtime_review: 'overtime', overtime_coord: 'overtime',
      overtime_coord_result: 'overtime', transfer: 'dashboard'
    };
    var dest = navMap[type];
    if (dest) App.navigate(dest);
  }

  function loadBadge(dotId) {
    API.getNotifications().then(function(res) {
      if (!res.ok) return;
      var data = res.data || [];

      // في وضع الموظف: عدّ فقط إشعاراته الخاصة
      if (!Auth.isAdminMode() && Auth.canElevate()) {
        var ownTypes = ['leave_submitted','overtime_submitted','leave_review','overtime_review','transfer','overtime_coord_result'];
        data = data.filter(function(n) { return ownTypes.indexOf(n.type) !== -1; });
      }

      var unread = data.filter(function(n) { return n.status === 'unread'; }).length;
      var dot = document.getElementById(dotId || 'notif-dot');
      if (dot) {
        dot.style.display = unread > 0 ? 'flex' : 'none';
        dot.textContent   = unread > 9 ? '9+' : (unread || '');
      }
    });
  }

  return { render, loadBadge, _readAndNav };
})();
