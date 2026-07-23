// ══════════════════════════════════════════════════════════
//  TIMEZONE HELPERS — konversi deterministik, ngerti DST otomatis
// ══════════════════════════════════════════════════════════
export function nthWeekdayOfMonth(year, month, weekday, nth) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  let count = 0;
  while (true) {
    if (d.getUTCDay() === weekday) {
      count++;
      if (count === nth) return d;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

export function lastWeekdayOfMonth(year, month, weekday) {
  const d = new Date(Date.UTC(year, month, 0));
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export function isUSDST(dateUTC) {
  const year = dateUTC.getUTCFullYear();
  const start = nthWeekdayOfMonth(year, 3, 0, 2);
  const end = nthWeekdayOfMonth(year, 11, 0, 1);
  return dateUTC >= start && dateUTC < end;
}

export function isEUDST(dateUTC) {
  const year = dateUTC.getUTCFullYear();
  const start = lastWeekdayOfMonth(year, 3, 0);
  const end = lastWeekdayOfMonth(year, 10, 0);
  return dateUTC >= start && dateUTC < end;
}

export function etToWIB(dateStr, hour, minute) {
  const refUTC = new Date(`${dateStr}T12:00:00Z`);
  const offsetET = isUSDST(refUTC) ? -4 : -5;
  const eventUTC = new Date(`${dateStr}T00:00:00Z`);
  eventUTC.setUTCHours(hour - offsetET, minute, 0, 0);
  return new Date(eventUTC.getTime() + 7 * 3600 * 1000);
}

export function cetToWIB(dateStr, hour, minute) {
  const refUTC = new Date(`${dateStr}T12:00:00Z`);
  const offsetCET = isEUDST(refUTC) ? 2 : 1;
  const eventUTC = new Date(`${dateStr}T00:00:00Z`);
  eventUTC.setUTCHours(hour - offsetCET, minute, 0, 0);
  return new Date(eventUTC.getTime() + 7 * 3600 * 1000);
}

export const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const MONTH_MAP = { Januari: 0, Februari: 1, Maret: 2, April: 3, Mei: 4, Juni: 5, Juli: 6, Agustus: 7, September: 8, Oktober: 9, November: 10, Desember: 11 };

export function fmtWIBDate(wibDate) {
  return `${wibDate.getUTCDate()} ${MONTH_NAMES[wibDate.getUTCMonth()]}`;
}
export function fmtWIBTime(wibDate) {
  const h = String(wibDate.getUTCHours()).padStart(2, "0");
  const m = String(wibDate.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
// Tanggal lengkap YYYY-MM-DD (WIB) — dipakai buat lookup harga historis,
// karena "date" yang ditampilkan ke user (mis. "15 Juli") kehilangan tahunnya.
export function fmtISODate(wibDate) {
  const y = wibDate.getUTCFullYear();
  const m = String(wibDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(wibDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Awal hari ini (UTC) — dipakai sebagai batas bawah "sudah lewat vs akan datang".
// Pakai awal HARI, bukan jam-menit sekarang, supaya event "hari ini" tetap muncul.
export function startOfTodayUTC(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
