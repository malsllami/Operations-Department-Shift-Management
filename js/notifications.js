// ============================================================
// الإشعارات
// ============================================================

var Notifications = (function () {

  function render(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    API.getNotifications().then(function(res) {
      if (!res.ok || !res.data.length) {
        el.innerHTML = '<div class="empty-state">لا توجد إشعارات</div>'; return;
      }

      el.innerHTML = '<div class="notif-list">' +
        res.data.map(function(n) { return _notifItem(n); }).join('') +
      '</div>';
    });
  }

  function _notifItem(n) {
    var stInfo = CONFIG.NOTIF_STATUS[n.status] || CONFIG.NOTIF_STATUS.read;
    var isDone = n.status === 'actioned';
    var typeColors = {
      leave_request:         { border:'#F59E0B', icon:'🏖️' },
      leave_review:          { border:'#10B981', icon:'✅' },
      overtime_request:      { border:'#6366F1', icon:'⏱️' },
      overtime_review:       { border:'#3B82F6', icon:'📋' },
      overtime_coord:        { border:'#8B5CF6', icon:'📤' },
      overtime_coord_result: { border:'#EC4899', icon:'📨' },
      transfer:              { border:'#F97316', icon:'🔀' }
    };
    var tc = typeColors[n.type] || { border:'#9CA3AF', icon:'🔔' };

    return '<div class="notif-item ' + (isDone ? 'notif-done' : n.status === 'unread' ? 'notif-unread' : 'notif-read') + '" ' +
      'style="border-right:4px solid ' + tc.border + '" ' +
      'onclick="Notifications._readAndNav(\'' + n.no + '\',\'' + n.type + '\',\'' + n.status + '\',this)">' +
      '<div class="notif-icon">' + tc.icon + '</div>' +
      '<div class="notif-body">' +
        '<div class="notif-title">' + (n.title||'') +
          (n.status === 'unread' ? '<span class="notif-badge-dot" style="background:' + stInfo.dot + '"></span>' : '') +
        '</div>' +
        '<div class="notif-msg">' + (n.msg||'') + '</div>' +
        '<div class="notif-date">' + (n.date||'') + (n.ref ? ' | ' + n.ref : '') + '</div>' +
      '</div>' +
    '</div>';
  }

  function _readAndNav(no, type, status, el) {
    if (status === 'unread') {
      API.markNotifRead(no).then(function() {
        App.loadNotifBadge();
      });
      el.classList.remove('notif-unread');
      el.classList.add('notif-read');
      var dot = el.querySelector('.notif-badge-dot');
      if (dot) dot.remove();
    }

    var navMap = {
      leave_request: 'leaves', leave_review: 'leaves',
      overtime_request: 'overtime', overtime_review: 'overtime',
      overtime_coord: 'overtime', overtime_coord_result: 'overtime',
      transfer: 'dashboard'
    };
    var dest = navMap[type];
    if (dest) App.navigate(dest);
  }

  // تحميل عدد الإشعارات للشارة
  function loadBadge(dotId) {
    API.getNotifications().then(function(res) {
      if (!res.ok) return;
      var unread = res.data.filter(function(n) { return n.status === 'unread'; }).length;
      var dot = document.getElementById(dotId || 'notif-dot');
      if (dot) {
        dot.style.display = unread > 0 ? 'flex' : 'none';
        dot.textContent = unread > 9 ? '9+' : (unread || '');
      }
    });
  }

  return { render, loadBadge, _readAndNav };
})();
