// ============================================================
// خريطة المحطات — جسر الربط (Bridge)
// يفتح Maps-of-Substations مع تسجيل الدخول التلقائي
// ============================================================

var Maps = (function () {

  var _phone = '';
  var _name  = '';

  // ============================================================
  // عرض الصفحة
  // ============================================================
  function render(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var user = Auth.getUser() || {};
    _name = user.name || '';

    var notConfigured = !CONFIG.MAPS_SITE_URL || CONFIG.MAPS_SITE_URL === 'YOUR_MAPS_SITE_URL_HERE';

    el.innerHTML =
      '<div class="maps-bridge-page">' +

        // تحذير إذا لم يُضبط الرابط
        (notConfigured
          ? '<div class="maps-bridge-warn">⚙️ لم يتم ضبط رابط موقع المحطات بعد — افتح <code>js/config.js</code> وضع الرابط في <code>MAPS_SITE_URL</code></div>'
          : '') +

        // قسم البحث
        '<div class="maps-bridge-search-section">' +
          '<h2 class="maps-bridge-title">🔍 البحث عن محطة</h2>' +
          '<div class="maps-bridge-search-wrap">' +
            '<input type="text" id="mb-search-q" class="maps-bridge-input"' +
              ' placeholder="رقم المحطة او اسم محطة التحويل" dir="ltr"' +
              ' onkeypress="if(event.key===\'Enter\')Maps.open(\'search\')">' +
          '</div>' +
          '<div class="maps-bridge-btns">' +
            '<button class="maps-bridge-btn mbb-search" onclick="Maps.open(\'search\')">🔍 بحث</button>' +
            '<button class="maps-bridge-btn mbb-dist"   onclick="Maps.open(\'add-dist\')">+ توزيع</button>' +
            '<button class="maps-bridge-btn mbb-sub"    onclick="Maps.open(\'add-sub\')">+ تحويل</button>' +
            '<button class="maps-bridge-btn mbb-fault"  onclick="Maps.open(\'fault\')">⚠ اعطال</button>' +
          '</div>' +
        '</div>' +

        // بطاقة الحالة — رقم الجوال
        '<div class="maps-bridge-info-card" id="mb-info">' +
          '<div class="loading-spinner"><div class="spinner small"></div></div>' +
        '</div>' +

      '</div>';

    // جلب رقم الجوال من بيانات الموظف
    API.getEmployee().then(function(res) {
      if (res.ok && res.data && res.data.phone) {
        _phone = res.data.phone;
        _renderInfoCard(true);
      } else {
        _renderInfoCard(false);
      }
    });
  }

  function _renderInfoCard(hasPhone) {
    var el = document.getElementById('mb-info');
    if (!el) return;
    if (hasPhone) {
      el.innerHTML =
        '<div class="mb-info-row">' +
          '<span class="mb-info-icon">✅</span>' +
          '<span>سيتم تسجيل دخولك تلقائياً في نظام المحطات بالجوال <strong dir="ltr">' + _phone + '</strong></span>' +
        '</div>';
    } else {
      el.innerHTML =
        '<div class="mb-info-row mb-info-warn">' +
          '<span class="mb-info-icon">⚠️</span>' +
          '<span>لا يوجد رقم جوال في ملفك — أضف رقمك من <strong>ملفي الشخصي</strong> لتسجيل الدخول التلقائي</span>' +
        '</div>';
    }
  }

  // ============================================================
  // فتح موقع المحطات مع بيانات الجسر
  // ============================================================
  function open(action) {
    var base = CONFIG.MAPS_SITE_URL;
    if (!base || base === 'YOUR_MAPS_SITE_URL_HERE') {
      App.toast('ضع رابط موقع المحطات في MAPS_SITE_URL داخل js/config.js', 'error');
      return;
    }

    // أضف query المحطة إذا كان البحث
    var q = '';
    if (action === 'search') {
      var inp = document.getElementById('mb-search-q');
      q = inp ? inp.value.trim() : '';
    }

    // بناء URL الجسر
    var url = base.replace(/\/$/, '') + '/index.html';
    var params = new URLSearchParams();
    if (_name)  params.set('bridge_name',   _name);
    if (_phone) params.set('bridge_phone',  _phone);
    params.set('bridge_action', action);
    if (q)      params.set('bridge_q', q);

    window.open(url + '?' + params.toString(), '_blank');
  }

  return { render: render, open: open };

})();
