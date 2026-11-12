(() => {
/**
 * app.js — State, Toast, Template Management Utilities
 * File .docx: Supabase Storage (cloud) atau base64 di localStorage (lokal)
 */

// ─── STATE ────────────────────────────────────────────────
const AppState = {
  get templates() {
    return DB.getArr(KEYS.templates);
  },
  saveTemplates(arr) {
    DB.set(KEYS.templates, arr);
  },
};

// ─── ESCAPE HTML ────────────────────────────────────────────
// Semua string dari data user / database WAJIB lewat sini sebelum masuk innerHTML.
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ─── SVG ICONS ────────────────────────────────────────────
// Pengganti emoji ikon (IDDS: ikon garis, bukan emoji).
const ICON_PATHS = {
  grid: '<path d="M10 13a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /> <path d="M13.45 11.55l2.05 -2.05" /> <path d="M6.4 20a9 9 0 1 1 11.2 0l-11.2 0" />',
  doc: '<path d="M14 3v4a1 1 0 0 0 1 1h4" /> <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" /> <path d="M9 9l1 0" /> <path d="M9 13l6 0" /> <path d="M9 17l6 0" />',
  upload: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /> <path d="M7 9l5 -5l5 5" /> <path d="M12 4l0 12" />',
  download: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /> <path d="M7 11l5 5l5 -5" /> <path d="M12 4l0 12" />',
  bolt: '<path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" />',
  trash: '<path d="M4 7l16 0" /> <path d="M10 11l0 6" /> <path d="M14 11l0 6" /> <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /> <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />',
  chart: '<path d="M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6" /> <path d="M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -10" /> <path d="M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -14" /> <path d="M4 20h14" />',
  book: '<path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /> <path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /> <path d="M3 6l0 13" /> <path d="M12 6l0 13" /> <path d="M21 6l0 13" />',
  db: '<path d="M4 6a8 3 0 1 0 16 0a8 3 0 1 0 -16 0" /> <path d="M4 6v6a8 3 0 0 0 16 0v-6" /> <path d="M4 12v6a8 3 0 0 0 16 0v-6" />',
  clock: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /> <path d="M12 7v5l3 3" />',
  check: '<path d="M5 12l5 5l10 -10" />',
  alert: '<path d="M12 9v4" /> <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /> <path d="M12 16h.01" />',
  archive: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2\" /> <path d=\"M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-10\" /> <path d=\"M10 12l4 0\" />',
  back: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M9 14l-4 -4l4 -4\" /> <path d=\"M5 10h11a4 4 0 1 1 0 8h-1\" />',
  briefcase: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9\" /> <path d=\"M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2\" /> <path d=\"M12 12l0 .01\" /> <path d=\"M3 13a20 20 0 0 0 18 0\" />',
  building: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M3 21l18 0\" /> <path d=\"M9 8l1 0\" /> <path d=\"M9 12l1 0\" /> <path d=\"M9 16l1 0\" /> <path d=\"M14 8l1 0\" /> <path d=\"M14 12l1 0\" /> <path d=\"M14 16l1 0\" /> <path d=\"M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16\" />',
  bulb: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7\" /> <path d=\"M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3\" /> <path d=\"M9.7 17l4.6 0\" />',
  calendar: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12\" /> <path d=\"M16 3v4\" /> <path d=\"M8 3v4\" /> <path d=\"M4 11h16\" /> <path d=\"M11 15h1\" /> <path d=\"M12 15v3\" />',
  car: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" /> <path d=\"M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" /> <path d=\"M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5\" />',
  city: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M3 21l18 0\" /> <path d=\"M5 21v-14l8 -4v18\" /> <path d=\"M19 21v-10l-6 -4\" /> <path d=\"M9 9l0 .01\" /> <path d=\"M9 12l0 .01\" /> <path d=\"M9 15l0 .01\" /> <path d=\"M9 18l0 .01\" />',
  clipboard: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2\" /> <path d=\"M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2\" /> <path d=\"M9 12l.01 0\" /> <path d=\"M13 12l2 0\" /> <path d=\"M9 16l.01 0\" /> <path d=\"M13 16l2 0\" />',
  cloud: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M6.657 18c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878\" />',
  coins: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M9 14c0 1.657 2.686 3 6 3s6 -1.343 6 -3s-2.686 -3 -6 -3s-6 1.343 -6 3\" /> <path d=\"M9 14v4c0 1.656 2.686 3 6 3s6 -1.344 6 -3v-4\" /> <path d=\"M3 6c0 1.072 1.144 2.062 3 2.598s4.144 .536 6 0c1.856 -.536 3 -1.526 3 -2.598c0 -1.072 -1.144 -2.062 -3 -2.598s-4.144 -.536 -6 0c-1.856 .536 -3 1.526 -3 2.598\" /> <path d=\"M3 6v10c0 .888 .772 1.45 2 2\" /> <path d=\"M3 11c0 .888 .772 1.45 2 2\" />',
  edit: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4\" /> <path d=\"M13.5 6.5l4 4\" />',
  eye: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" /> <path d=\"M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6\" />',
  filedesc: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M14 3v4a1 1 0 0 0 1 1h4\" /> <path d=\"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2\" /> <path d=\"M9 17h6\" /> <path d=\"M9 13h6\" />',
  files: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M15 3v4a1 1 0 0 0 1 1h4\" /> <path d=\"M18 17h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h4l5 5v7a2 2 0 0 1 -2 2\" /> <path d=\"M16 17v2a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2\" />',
  folder: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2\" />',
  globe: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M7 9a4 4 0 1 0 8 0a4 4 0 0 0 -8 0\" /> <path d=\"M5.75 15a8.015 8.015 0 1 0 9.25 -13\" /> <path d=\"M11 17v4\" /> <path d=\"M7 21h8\" />',
  home: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M5 12l-2 0l9 -9l9 9l-2 0\" /> <path d=\"M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7\" /> <path d=\"M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6\" />',
  hourglass: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M6.5 7h11\" /> <path d=\"M6.5 17h11\" /> <path d=\"M6 20v-2a6 6 0 1 1 12 0v2a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1\" /> <path d=\"M6 4v2a6 6 0 1 0 12 0v-2a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1\" />',
  info: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0\" /> <path d=\"M12 9h.01\" /> <path d=\"M11 12h1v4h1\" />',
  lock: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6\" /> <path d=\"M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0\" /> <path d=\"M8 11v-4a4 4 0 1 1 8 0v4\" />',
  map: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M3 7l6 -3l6 3l6 -3v13l-6 3l-6 -3l-6 3v-13\" /> <path d=\"M9 4v13\" /> <path d=\"M15 7v13\" />',
  mappin: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\" /> <path d=\"M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0\" />',
  note: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M13 20l7 -7\" /> <path d=\"M13 20v-6a1 1 0 0 1 1 -1h6v-7a2 2 0 0 0 -2 -2h-12a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7\" />',
  notebook: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-11a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1m3 0v18\" /> <path d=\"M13 8l2 0\" /> <path d=\"M13 12l2 0\" />',
  package: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5\" /> <path d=\"M12 12l8 -4.5\" /> <path d=\"M12 12l0 9\" /> <path d=\"M12 12l-8 -4.5\" /> <path d=\"M16 5.25l-8 4.5\" />',
  pin: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4\" /> <path d=\"M9 15l-4.5 4.5\" /> <path d=\"M14.5 4l5.5 5.5\" />',
  plane: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M16 10h4a2 2 0 0 1 0 4h-4l-4 7h-3l2 -7h-4l-2 2h-3l2 -4l-2 -4h3l2 2h4l-2 -7h3l4 7\" />',
  receipt: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2m4 -14h6m-6 4h6m-2 4h2\" />',
  refresh: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4\" /> <path d=\"M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4\" />',
  repeat: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M4 12v-3a3 3 0 0 1 3 -3h13m-3 -3l3 3l-3 3\" /> <path d=\"M20 12v3a3 3 0 0 1 -3 3h-13m3 3l-3 -3l3 -3\" />',
  save: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2\" /> <path d=\"M10 14a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" /> <path d=\"M14 4l0 4l-6 0l0 -4\" />',
  search: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0\" /> <path d=\"M21 21l-6 -6\" />',
  settings: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065\" /> <path d=\"M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\" />',
  sparkles: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6\" />',
  square: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14\" />',
  squarecheck: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14\" /> <path d=\"M9 12l2 2l4 -4\" />',
  tool: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5\" />',
  users: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0\" /> <path d=\"M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2\" /> <path d=\"M16 3.13a4 4 0 0 1 0 7.75\" /> <path d=\"M21 21v-2a4 4 0 0 0 -3 -3.85\" />',
  user: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0\" /> <path d=\"M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2\" />',
  x: '<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\" /> <path d=\"M18 6l-12 12\" /> <path d=\"M6 6l12 12\" />',
  logout: '<path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" /> <path d="M9 12h12l-3 -3" /> <path d="M18 15l3 -3" />',
};

function ic(name, size = 17) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px">${ICON_PATHS[name] || ''}</svg>`;
}


// ─── EXTRACT PLACEHOLDERS dari DOCX ───────────────────────
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

function placeholdersFromXml(xmlText) {
  // Jangan sisipkan spasi antar <w:t> — Word sering memecah {{tag}} jadi beberapa run
  const plain = xmlText.replace(/<[^>]+>/g, '');
  const found = new Set();
  let m;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(plain)) !== null) {
    found.add(m[1]);
  }
  return found;
}

async function extractPlaceholders(file) {
  try {
    const zip = await JSZip.loadAsync(file);
    const xmlParts = Object.keys(zip.files).filter(
      (name) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(name)
    );
    if (!xmlParts.length) throw new Error('Bukan file DOCX yang valid');

    const found = new Set();
    for (const name of xmlParts) {
      const xmlText = await zip.file(name).async('string');
      placeholdersFromXml(xmlText).forEach((p) => found.add(p));
    }
    return [...found].sort();
  } catch (e) {
    console.error('Extract error:', e);
    throw e;
  }
}

// ─── TEMPLATE UPLOAD HANDLER ──────────────────────────────
async function handleTemplateUpload(file) {
  if (!file || !file.name.endsWith('.docx')) {
    return toast('Hanya file .docx yang didukung', 'error');
  }
  const statusEl = document.getElementById('upload-status');
  if (statusEl) statusEl.innerHTML = `<div class="alert alert-info">⏳ Membaca file dan mendeteksi placeholder...</div>`;

  try {
    const placeholders = await extractPlaceholders(file);
    showUploadForm(file.name, placeholders, file);
    if (statusEl) {
      if (placeholders.length === 0) {
        statusEl.innerHTML = `
          <div class="alert alert-warning">
            ${ic('alert', 15)} Tidak ada placeholder <code>{{nama_argument}}</code> terdeteksi.
            Pastikan template memakai format <strong>{{nomor}}</strong>, <strong>{{nama_penerima_1}}</strong>, dll.
            (bukan tag conditional <code>{{#ada_peserta_2}}</code> saja).
            Untuk kwitansi 1–3 peserta, gunakan file <strong>templates/kwitansi.docx</strong> dari proyek ini.
          </div>`;
      } else {
        statusEl.innerHTML = `<div class="alert alert-success">${ic('check', 15)} Berhasil membaca file. Ditemukan <strong>${placeholders.length} placeholder</strong>.</div>`;
      }
    }
  } catch (err) {
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-warning">${ic('alert', 15)} ${err.message}</div>`;
    toast(err.message, 'error');
  }
}

function showUploadForm(fileName, placeholders, pendingFile) {
  const formEl = document.getElementById('upload-form');
  if (!formEl) return;
  formEl.style.display = 'block';
  const fnEl = document.getElementById('tf-filename');
  if (fnEl) fnEl.textContent = fileName;

  const chipsEl = document.getElementById('tf-placeholders');
  if (chipsEl) {
    chipsEl.innerHTML = placeholders.length
      ? placeholders.map(p => `
          <span class="chip">
            {{${p}}}
            <em class="chip-remove" onclick="this.closest('.chip').remove()" style="cursor:pointer;font-style:normal;margin-left:4px;opacity:.6">${ic('x', 12)}</em>
          </span>`).join('')
      : '<span class="text-muted text-sm">Tidak ada placeholder terdeteksi. Tambah manual di bawah.</span>';
  }

  formEl._pendingFile = pendingFile instanceof File ? pendingFile : null;
  delete formEl.dataset.fileData;
  formEl.dataset.fileName = fileName;
  onTemplateJenisChange();
}

function addManualPlaceholder() {
  const input = document.getElementById('manual-ph');
  if (!input) return;
  const val = input.value.trim().replace(/[{}]/g, '');
  if (!val) return;
  const chipsEl = document.getElementById('tf-placeholders');
  if (chipsEl) {
    chipsEl.insertAdjacentHTML('beforeend', `
      <span class="chip">
        {{${val}}}
        <em class="chip-remove" onclick="this.closest('.chip').remove()" style="cursor:pointer;font-style:normal;margin-left:4px;opacity:.6">${ic('x', 12)}</em>
      </span>`);
  }
  input.value = '';
  input.focus();
}

function getKwitansiLayoutFromForm() {
  const jenis = document.getElementById('tf-jenis')?.value;
  if (jenis !== 'kwitansi') {
    return document.getElementById('tf-iterable')?.checked ? 'per_peserta' : null;
  }
  return document.getElementById('tf-kwitansi-layout')?.value || 'per_halaman';
}

function onTemplateJenisChange() {
  const jenis = document.getElementById('tf-jenis')?.value;
  const kwitansiWrap = document.getElementById('tf-kwitansi-layout-wrap');
  const iterableWrap = document.getElementById('tf-iterable-wrap');
  if (kwitansiWrap) kwitansiWrap.style.display = jenis === 'kwitansi' ? '' : 'none';
  if (iterableWrap) iterableWrap.style.display = jenis === 'kwitansi' ? 'none' : '';
}

async function saveTemplateForm() {
  const formEl = document.getElementById('upload-form');
  const nama = document.getElementById('tf-nama')?.value.trim();
  const jenis = document.getElementById('tf-jenis')?.value;
  const scope = document.getElementById('tf-scope')?.value;
  const deskripsi = document.getElementById('tf-deskripsi')?.value.trim();
  const kwitansiLayout = jenis === 'kwitansi' ? getKwitansiLayoutFromForm() : null;
  const isIterable = jenis === 'kwitansi'
    ? kwitansiLayout === 'per_peserta'
    : !!document.getElementById('tf-iterable')?.checked;
  if (!nama) return toast('Nama template wajib diisi', 'error');
  const pendingFile = formEl?._pendingFile;
  if (!pendingFile) return toast('File belum diupload', 'error');

  const chips = [...document.querySelectorAll('#tf-placeholders .chip')];
  const placeholders = chips.map(c => {
    return c.childNodes[0].textContent.trim().replace(/[{}]/g, '').trim();
  }).filter(Boolean);

  const id = 'tpl_' + Date.now();
  const fileName = formEl.dataset.fileName || pendingFile.name;

  const activeBtn = formEl?.querySelector('.btn-primary');
  const prevLabel = activeBtn?.innerHTML;
  if (activeBtn) {
    activeBtn.disabled = true;
    activeBtn.textContent = 'Menyimpan...';
  }

  try {
    const fileData = await TemplateStorage.fileToBase64(pendingFile);
    let storagePath;
    if (TemplateStorage.canUse()) {
      try {
        storagePath = await TemplateStorage.upload(pendingFile, id);
      } catch (upErr) {
        console.warn('[TemplateStorage] upload skipped, fallback ke fileData:', upErr?.message || upErr);
      }
    }
    const record = {
      id,
      nama,
      jenis,
      scope,
      deskripsi: deskripsi || '',
      isIterable: !!isIterable,
      kwitansiLayout: kwitansiLayout || undefined,
      placeholders,
      fileName,
      fileData,
      ...(storagePath ? { storagePath } : {}),
      fileSize: pendingFile.size,
      createdAt: new Date().toISOString(),
    };

    const templates = AppState.templates;
    templates.push(record);
    AppState.saveTemplates(templates);
    await DB.flush();

    formEl.style.display = 'none';
    formEl._pendingFile = null;
    document.getElementById('upload-status').innerHTML = '';
    ['tf-nama', 'tf-deskripsi'].forEach((fid) => {
      const el = document.getElementById(fid);
      if (el) el.value = '';
    });
    const phEl = document.getElementById('tf-placeholders');
    if (phEl) phEl.innerHTML = '';
    const iterEl = document.getElementById('tf-iterable');
    if (iterEl) iterEl.checked = false;
    const layoutEl = document.getElementById('tf-kwitansi-layout');
    if (layoutEl) layoutEl.value = 'per_halaman';
    onTemplateJenisChange();

    renderTemplateList();
    updateTemplateBadge();
    const loc = TemplateStorage.canUse() ? ' (cloud storage)' : '';
    toast(`Template "${nama}" berhasil disimpan${loc}`, 'success');
  } catch (err) {
    console.error(err);
    toast(err.message || 'Gagal menyimpan template', 'error');
  } finally {
    if (activeBtn) {
      activeBtn.disabled = false;
      activeBtn.innerHTML = prevLabel || 'Simpan';
    }
  }
}

// ─── RENDER TEMPLATE LIST ─────────────────────────────────
const JENIS_META = {
  kwitansi: { label: 'Kwitansi', icon: 'doc', bg: '#E8F5E9', tc: '#2E7D32' },
  sppd: { label: 'SPPD', icon: 'doc', bg: '#E3F2FD', tc: '#1565C0' },
  surat_tugas: { label: 'Surat Tugas', icon: 'doc', bg: '#FFF3E0', tc: '#E65100' },
  rekap_belanja: { label: 'Rekap Belanja', icon: 'chart', bg: '#F3E5F5', tc: '#6A1B9A' },
  nota_dinas: { label: 'Nota Dinas', icon: 'doc', bg: '#E8EAF6', tc: '#283593' },
  custom: { label: 'Custom', icon: 'doc', bg: '#F5F5F5', tc: '#616161' },
};

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function renderTemplateList() {
  const container = document.getElementById('template-list');
  if (!container) return;
  const templates = AppState.templates;
  updateTemplateBadge();

  if (templates.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${ic('doc', 28)}</div>
        <div class="empty-state-title">Belum ada template</div>
        <div class="empty-state-desc">Upload file .docx untuk mulai</div>
      </div>`;
    return;
  }

  container.innerHTML = templates.map(t => {
    const j = JENIS_META[t.jenis] || JENIS_META.custom;
    const scopeBadge = t.scope === 'global'
      ? `<span class="badge badge-computed">${ic('globe', 12)} Global</span>`
      : `<span class="badge badge-manual">${ic('user', 12)} Personal</span>`;
    const kLayout = t.kwitansiLayout || (t.isIterable ? 'per_peserta' : 'per_halaman');
    const loopBadge = t.isIterable
      ? '<span class="badge badge-loop">Loop</span>'
      : (t.jenis === 'kwitansi' && kLayout === 'per_halaman'
        ? `<span class="badge badge-loop">${ic('doc', 12)} 1–3/hal</span>` : '');
    const storageBadge = t.storagePath
      ? `<span class="badge badge-computed" title="File di Supabase Storage">${ic('package', 12)} Storage</span>`
      : (t.fileData ? `<span class="badge badge-manual" title="File di browser">${ic('save', 12)} Lokal</span>` : '');

    const shown = (t.placeholders || []).slice(0, 5);
    const more = (t.placeholders || []).length > 5
      ? `<span class="text-muted text-sm" style="align-self:center">+${t.placeholders.length - 5} lainnya</span>` : '';

    const chips = shown.map(p =>
      `<span class="chip" style="font-size:10px;padding:2px 8px">{{${escapeHtml(p)}}}</span>`
    ).join('');

    const createdAt = new Date(t.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const sizeLabel = t.fileSize ? formatFileSize(t.fileSize) : '';

    return `
      <div class="card mb-4">
        <div class="card-header" style="background:${j.bg}22">
          <div class="card-icon" style="background:${j.bg};color:${j.tc}">${ic(j.icon, 20)}</div>
          <div style="flex:1;min-width:0">
            <h3 style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(t.nama)}</h3>
            <p>${t.deskripsi ? escapeHtml(t.deskripsi) : '<em style="opacity:.6">Tidak ada deskripsi</em>'}</p>
          </div>
          <div class="flex gap-2 items-center" style="flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
            ${scopeBadge} ${loopBadge} ${storageBadge}
            <button class="btn btn-secondary btn-sm" onclick="downloadTemplate('${escapeHtml(t.id)}')">${ic('download', 15)}</button>
            <button class="btn btn-danger btn-sm" onclick="deleteTemplate('${escapeHtml(t.id)}')">${ic('trash', 15)}</button>
          </div>
        </div>
        <div class="card-body" style="padding:12px 20px">
          <div class="flex justify-between items-center" style="margin-bottom:8px">
            <span style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em">${t.placeholders?.length || 0} Placeholder</span>
            <span class="text-sm text-muted">${ic('calendar', 15)} ${createdAt} · ${escapeHtml(t.fileName)}${sizeLabel ? ' · ' + sizeLabel : ''}</span>
          </div>
          <div class="flex" style="flex-wrap:wrap;gap:5px;align-items:center">${chips}${more}</div>
        </div>
      </div>`;
  }).join('');
}

async function deleteTemplate(id) {
  const t = AppState.templates.find(x => x.id === id);
  if (!t) return;
  if (!confirm(`Pindahkan template "${t.nama}" ke Trash?`)) return;

  try {
    DB.moveToTrash(KEYS.templates, id, t.nama || 'Template');
    await DB.flush();
    renderTemplateList();
    updateTemplateBadge();
    toast('Template dipindahkan ke Trash', 'success');
  } catch (err) {
    toast(err.message || 'Gagal menghapus template', 'error');
  }
}

async function downloadTemplate(id) {
  const t = AppState.templates.find(x => x.id === id);
  if (!t || !TemplateStorage.hasFile(t)) return toast('Data file tidak tersedia', 'error');

  try {
    const b64 = await TemplateStorage.downloadBase64(t);
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = t.fileName || 'template.docx';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast(err.message || 'Gagal mengunduh template', 'error');
  }
}

function updateTemplateBadge() {
  const templates = AppState.templates;
  const el = document.getElementById('template-count');
  if (el) el.textContent = templates.length + ' template';
}

// ─── PANDUAN SEARCH ───────────────────────────────────────
function initPanduanSearch() {
  const input = document.getElementById('panduan-search');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    document.querySelectorAll('.panduan-row').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

// ___ PUBLIC API (sengaja global; sisanya privat file ini) ___
Object.assign(globalThis, { AppState, addManualPlaceholder, deleteTemplate, downloadTemplate, escapeHtml, handleTemplateUpload, ic, initPanduanSearch, onTemplateJenisChange, renderTemplateList, saveTemplateForm, updateTemplateBadge });
})();
