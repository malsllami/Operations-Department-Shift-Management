// ============================================================
// تحويل التاريخ الميلادي إلى الهجري
// ============================================================

var Hijri = (function () {

  function toHijri(gYear, gMonth, gDay) {
    var jd = _gregorianToJD(gYear, gMonth, gDay);
    return _jdToHijri(jd);
  }

  function fromDate(dateObj) {
    return toHijri(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate());
  }

  function formatDate(dateObj) {
    var h = fromDate(dateObj);
    return h.day + ' ' + CONFIG.HIJRI_MONTHS[h.month - 1] + ' ' + h.year + ' هـ';
  }

  function formatShort(dateObj) {
    var h = fromDate(dateObj);
    var p = function(n) { return n < 10 ? '0'+n : String(n); };
    return p(h.day) + '/' + p(h.month) + '/' + h.year;
  }

  function _gregorianToJD(y, m, d) {
    if (m < 3) { y--; m += 12; }
    var A = Math.floor(y / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524;
  }

  function _jdToHijri(jd) {
    jd = Math.floor(jd) + 0.5;
    var z   = jd - 1948439.5;
    var cyc = Math.floor((z - 1) / 10631);
    z = z - 10631 * cyc - 1;
    var j    = Math.floor((z - 0.02) / 354.367);
    var year = 30 * cyc + j;
    z = z - Math.floor(j * 354.367 + 0.5);
    var month = Math.floor((z + 0.5) / 29.5) + 1;
    if (month > 12) month = 12;
    var day   = z - Math.floor(29.5 * (month - 1) + 0.5) + 1;
    return { year: year, month: month, day: day };
  }

  return { toHijri: toHijri, fromDate: fromDate, formatDate: formatDate, formatShort: formatShort };
})();
