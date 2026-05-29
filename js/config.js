// ============================================================
// إعدادات الواجهة الأمامية — نظام إدارة الورديات
// المفاتيح الداخلية بالإنجليزية — العرض بالعربية
// ============================================================

var CONFIG = {

  // رابط Google Apps Script Web App — يُملأ بعد النشر
  API_URL: 'YOUR_GAS_WEB_APP_URL_HERE',

  // ---- ألوان الشعار (السعودية للطاقة) ----
  BRAND: {
    primary:   '#0066B3',
    secondary: '#00AEEF',
    accent:    '#00C5A3',
    dark:      '#004A8F',
    light:     '#E8F4FF',
    green:     '#00843D'
  },

  // ---- ألوان الورديات ----
  SHIFTS: {
    a: { label:'أ', color:'#1565C0', bg:'#DBEAFE', border:'#1565C0', text:'#1E3A8A' },
    b: { label:'ب', color:'#00838F', bg:'#CCFBF1', border:'#00838F', text:'#134E4A' },
    c: { label:'ج', color:'#2E7D32', bg:'#DCFCE7', border:'#2E7D32', text:'#14532D' },
    d: { label:'د', color:'#6A1B9A', bg:'#F3E8FF', border:'#6A1B9A', text:'#581C87' }
  },

  // ---- مواضع الورديات على تاريخ المرجع (2026-05-26) ----
  // مُحقَّق: الأربعاء 2026-05-27 → أ=راحة1، ب=مساء1، ج=صباح1، د=راحة3
  SHIFT_POS: { a:3, b:1, c:7, d:5 },
  REF_DATE: '2026-05-26',

  // ---- حالات الورديات ----
  STATUS: {
    morning: { bg:'#FFF8E1', text:'#E65100', badge:'#F57C00', icon:'☀',  label:'صباح'  },
    evening: { bg:'#EDE7F6', text:'#4527A0', badge:'#5E35B1', icon:'🌙', label:'مساء'  },
    off:     { bg:'#F5F5F5', text:'#757575', badge:'#9E9E9E', icon:'🏠', label:'راحة'  }
  },

  // ---- تلوين أيام انتهاء البطاقات ----
  EXPIRY: {
    safe:   { min:100, bg:'#C8E6C9', text:'#1B5E20', label:'جيد'      },
    warn:   { min:30,  bg:'#FFE0B2', text:'#E65100', label:'قريب'     },
    alert:  { min:1,   bg:'#FFF9C4', text:'#F57F17', label:'عاجل'     },
    danger: { min:-999,bg:'#FFCDD2', text:'#B71C1C', label:'منتهية'   }
  },

  // ---- أنواع الإجازات (قابلة للتوسع) ----
  LEAVE_TYPES: [
    { key:'annual',       label:'سنوية',           hasBalance: true  },
    { key:'scheduled',    label:'مجدولة',          hasBalance: true  },
    { key:'sick',         label:'مرضية',           hasBalance: false },
    { key:'birth',        label:'مولود',           hasBalance: false },
    { key:'death',        label:'وفاة',            hasBalance: false },
    { key:'marriage',     label:'زواج',            hasBalance: false },
    { key:'exam',         label:'اختبارات',        hasBalance: false },
    { key:'work_course',  label:'دورة عمل',        hasBalance: false },
    { key:'long_service', label:'خدمة عمل طويلة', hasBalance: false },
    { key:'other',        label:'أخرى',            hasBalance: false }
  ],

  // ---- مناطق ----
  REGIONS: [
    { key:'north',  label:'شمال' },
    { key:'south',  label:'جنوب' },
    { key:'east',   label:'شرق'  },
    { key:'west',   label:'غرب'  },
    { key:'center', label:'وسط'  }
  ],

  // ---- الصلاحيات ----
  ROLES: [
    { key:'admin',      label:'مدير',              code: true  },
    { key:'supervisor', label:'مشرف وردية',        code: true  },
    { key:'viewer',     label:'تنسيق إداري',       code: true  },
    { key:'employee',   label:'موظف',              code: false }
  ],

  // ---- ألوان مراحل الأوفرتايم ----
  OT_STATUS: {
    created:              { label:'تم الإنشاء',             bg:'#FFF3CD', text:'#856404'  },
    pending_supervisor:   { label:'قيد مراجعة المشرف',     bg:'#FFF9C4', text:'#F57F17'  },
    supervisor_approved:  { label:'معتمد من المشرف',       bg:'#DBEAFE', text:'#1E3A8A'  },
    rejected:             { label:'مرفوض',                 bg:'#FFCDD2', text:'#B71C1C'  },
    sent_to_coordinator:  { label:'أُرسل للتنسيق الإداري', bg:'#E0F2FE', text:'#0369A1'  },
    returned_to_supervisor: { label:'أُعيد للمشرف',        bg:'#FEF3C7', text:'#92400E'  },
    sent_to_system:       { label:'تم الإرسال للنظام',    bg:'#D1FAE5', text:'#065F46'  },
    received:             { label:'تم الاستلام',           bg:'#C8E6C9', text:'#1B5E20'  },
    not_received:         { label:'لم يتم الاستلام',       bg:'#E0E0E0', text:'#424242'  }
  },

  // ---- ألوان مراحل الإشعارات ----
  NOTIF_STATUS: {
    unread:    { dot:'#EF4444', label:'جديد'    },
    read:      { dot:'#9CA3AF', label:'مقروء'   },
    actioned:  { dot:'#6B7280', label:'منتهي'   }
  },

  // ---- أيام وأشهر بالعربية ----
  DAYS_AR:   ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'],
  MONTHS_AR: ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
               'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
  HIJRI_MONTHS: ['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة',
                 'رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'],

  // ---- دورة الورديات ----
  CYCLE:    ['morning','morning','evening','evening','off','off','off','off'],
  CYCLE_AR: ['صباح','صباح','مساء','مساء','راحة','راحة','راحة','راحة'],

  // ============================================================
  // دوال مساعدة
  // ============================================================

  fmtDate: function(val) {
    if (!val) return '—';
    var s = String(val);
    var m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : s;
  },

  expiryClass: function(days) {
    if (days === null || days === undefined || days === '') return null;
    var d = parseInt(days);
    if (d >= 100) return CONFIG.EXPIRY.safe;
    if (d >= 30)  return CONFIG.EXPIRY.warn;
    if (d >= 1)   return CONFIG.EXPIRY.alert;
    return CONFIG.EXPIRY.danger;
  },

  shiftKey: function(letter) {
    return { 'أ':'a','ب':'b','ج':'c','د':'d' }[letter] || 'a';
  },

  shiftLabel: function(key) {
    var s = CONFIG.SHIFTS[key];
    return s ? 'وردية ' + s.label : (key || '—');
  },

  getShiftStatus: function(shiftLetter, dateStr) {
    var posMap = CONFIG.SHIFT_POS;
    var key    = CONFIG.shiftKey(shiftLetter);
    var ref    = new Date(CONFIG.REF_DATE); ref.setHours(0,0,0,0);
    var target = new Date(dateStr);         target.setHours(0,0,0,0);
    var diff   = Math.round((target - ref) / 86400000);
    var pos    = ((diff + (posMap[key] || 0)) % 8 + 8) % 8;
    return { en: CONFIG.CYCLE[pos], ar: CONFIG.CYCLE_AR[pos], idx: pos };
  },

  otStatusInfo: function(status) {
    return CONFIG.OT_STATUS[status] || { label: status, bg:'#F5F5F5', text:'#424242' };
  },

  todayStr: function() {
    var d = new Date();
    return d.getFullYear() + '-' + CONFIG._p(d.getMonth()+1) + '-' + CONFIG._p(d.getDate());
  },

  _p: function(n) { return n < 10 ? '0'+n : String(n); },

  toArabicNums: function(str) {
    var ar = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    return String(str).replace(/[0-9]/g, function(d) { return ar[d]; });
  },

  toLatinNums: function(str) {
    return String(str)
      .replace(/[٠-٩]/g, function(d) { return String(d.charCodeAt(0) - 1632); })
      .replace(/[۰-۹]/g, function(d) { return String(d.charCodeAt(0) - 1776); });
  },

  validatePhone: function(phone) {
    var latin = CONFIG.toLatinNums(String(phone || '')).trim();
    return /^5\d{8}$/.test(latin);
  }
};
