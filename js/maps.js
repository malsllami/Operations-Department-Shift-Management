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
        '<div id="mb-info">' +
          '<div class="loading-spinner"><div class="spinner small"></div></div>' +
        '</div>' +

      '</div>';

    // جلب رقم الجوال من بيانات الموظف
    API.getEmployee().then(function(res) {
      if (res.ok && res.data && res.data.phone) {
        _phone = res.data.phone;
        _renderInfoCard(true);
      } else {
        _phone = '';
        _renderInfoCard(false);
      }
    });
  }

  function _renderInfoCard(hasPhone) {
    var el = document.getElementById('mb-info');
    if (!el) return;
    if (hasPhone) {
      el.innerHTML =
        '<div class="mb-status-ok">' +
          '<span class="mb-status-icon">✅</span>' +
          '<div class="mb-status-text">' +
            '<strong>أنت جاهز للاستخدام</strong>' +
            '<span>سيتم تسجيل دخولك تلقائياً بالجوال <span dir="ltr">' + _phone + '</span></span>' +
          '</div>' +
        '</div>';
    } else {
      el.innerHTML =
        '<div class="mb-status-block">' +
          '<div class="mb-status-error">' +
            '<span class="mb-status-icon">🚫</span>' +
            '<div class="mb-status-text">' +
              '<strong>مطلوب — رقم الجوال غير مسجل</strong>' +
              '<span>يجب إضافة رقم جوالك في <strong>ملفي الشخصي</strong> قبل استخدام خريطة المحطات</span>' +
            '</div>' +
          '</div>' +
          '<button class="mb-goto-profile btn-primary" onclick="App.navigate(\'profile\')">' +
            '👤 اذهب إلى ملفي الشخصي وأضف الجوال' +
          '</button>' +
        '</div>';

      // تعطيل الأزرار الأربعة بصرياً
      var btns = document.querySelectorAll('.maps-bridge-btn');
      btns.forEach(function(b) {
        b.disabled = true;
        b.classList.add('mbb-disabled');
      });
    }
  }

  // ============================================================
  // فتح موقع المحطات مع بيانات الجسر
  // ============================================================
  function open(action) {
    // منع الانتقال إذا لم يوجد رقم جوال
    if (!_phone) {
      App.toast('يجب تسجيل رقم جوالك في ملفك الشخصي أولاً', 'error');
      return;
    }

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
