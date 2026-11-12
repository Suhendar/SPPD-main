# STATE — SPPD (save state)

## Cara pakai
File ini ringkasan sesi. Sesi baru: baca file ini + `git status --short` + `git log --oneline -5`.

## Status kerja (per Nov 2026)
- User commit sendiri (`dah bre cek commit`). Asisten tidak commit/push.
- Tema IDDS: biru produk `#0956C3`, badge soft, ikon Tabler inline. `ina.png` oke.
- Harness `npm test` (`node --test tests/*.test.mjs`) — 41 tes, 40 ijo, 1 fail env (`smoke.test.mjs` butuh `python3`, tak ada di Windows; pre-existing).
- Env (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, opsional `AI_DAILY_LIMIT`, `GEMINI_MODEL`) diisi manual di dashboard Vercel oleh user.

## Yang sudah selesai
- Nota Dinas: `templates/nota_dinas_template.docx` (15 placeholder, font Arial), form + prefill + generate, mode `nota_dinas` di `api/gemini.js`, tombol AI Hasil & Kesimpulan (Bearer JWT).
- Rekap belanja loop `{{#rekap_rows}}` tanpa batas; Dasar Surat Tugas loop `{{#dasar_list}}` (nomor otomatis).
- Keamanan: `/api/gemini` wajib JWT + CORS ketat + body 20KB + rate-limit 30/hari (`sppd_ai_usage`) + audit trigger; fail-closed build; `escapeHtml` global; `storage.sql` kunci `%.docx`; signup publik mati; SRI + pin CDN + CSP.
- Lokal: `scripts/dev-server.py` proxy `SPPD_API_UPSTREAM` (http.server biasa 501 buat POST); favicon inline SVG.
- Refaktor JS: tiap file `js/*.js` dibungkus IIFE + `Object.assign(globalThis, {...})`; duplikat `toast` (canonical di `auth.js`) & `formatRupiah` (canonical di `terbilang.js`) dihapus; `config.js` dibiarkan global; `upgrade/js/anggaran.js` memang sudah IIFE.
- Tes `tests/exports.test.mjs`: semua fungsi di handler `on*` (semua gaya quote) wajib terdaftar global — menangkap 4 export kelewat (`updateLamaPreview`, `updateTarifPreview`, `updateTujuanField`, `staiToggleExisting`).
- Sapu emoji: nol emoji di `js/*.js` + `index.html` + `login.html` (SVG Tabler / teks polos).
- Generate page tetap search + select (combobox custom ditolak user-setuju: `.card{overflow:hidden}` potong popup, biaya keyboard/ARIA/mobile picker; label "Hasil Pencarian"→"Pilih Perjalanan Dinas", placeholder dipadatkan).
- SPPD Multi grup @6: `templates/SPPD_draft_Multi_V1.4.4.docx` blok per grup `{{#sppd_groups}}` (1 utama `{{nama_utama}}` + loop `{{#pengikut}}` maks 5/tabel, tag buka nempel `{{nama}}` biar sel nomor kosong; backup `.bak.docx` + `.orig.docx`; V1.4.2 dihapus user, V1.4.3 = desain loop-tunggal di-save ulang Word, superseded); `buildBaseArgs` tambah `sppd_groups` (+ `pengikut_lampiran`, `pangkat_gol`); STAI indexed minimal 10 tanpa cap; tes `tests/pengikut-loop.test.mjs` 4/4 ijo (render probe 1/6/7/13/20 OK; Word OK).

## Yang belum / risiko
- Redeploy Vercel + pastikan env (terutama `GEMINI_MODEL`; default coba `gemini-3.6-flash` → `3.8-flash`).
- Proteksi password bocor (dashboard Auth) belum dikonfirmasi user.
- `upgrade/` belum diaudit penuh.
- Verifikasi klik-per-klik di browser tetap wewenang user (statis + tes tidak gantikan klik).

## Perintah penting
- `npm test` — harness (41 tes).
- Edit `.docx` via ElementTree wajib gabung xmlns asli+hasil (Word strict: prefix di `mc:Ignorable`/`Requires` + prefix terpakai harus terdeklarasi) + validasi Word COM + `lxml` strict + render docxtemplater N=1/6/7/13/20.
- `SPPD_API_UPSTREAM=https://xxx.vercel.app python3 scripts/dev-server.py 8000` — lokal + proxy API.
- `python3 -c` via zipfile — cek font/format `.docx` tanpa Word.
- Jangan `rm`/bersihkan file user; server dev selalu dimatikan setelah smoke (`ps | grep dev-server`).
