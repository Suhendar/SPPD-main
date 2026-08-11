# Task: Tabel Lampiran Multi-Peserta di Surat Tugas (docxtemplater loop)

## Konteks
Template `Surat_tugas_draft (2).docx` yang diupload user punya halaman
Lampiran berisi tabel NO/NAMA/JABATAN yang **dihardcode 5 baris**, dan
cuma 2 baris pertama yang punya placeholder (`{{nama_peserta_1}}`,
`{{nama_peserta_2}}`) — sisanya kosong. Placeholder JABATAN-nya juga
salah: `{{jabatan}}` (bukan `{{jabatan_peserta_1}}` /
`{{jabatan_peserta_2}}`), jadi selalu kosong karena `buildBaseArgs()`
tidak pernah mengisi key `jabatan` di top-level.

Akar masalahnya: sistem generate saat ini (fungsi `buildBaseArgs()` di
`js/generate.js`) memang membuat `nama_peserta_1..N`, `jabatan_peserta_1..N`
dst secara dinamis sesuai jumlah peserta — tapi karena docxtemplater
di-render tanpa modul loop tabel, template **harus** hardcode jumlah baris
dan nomor index-nya di Word. Itu sebabnya "jumlah peserta dinamis" tidak
pernah benar-benar bisa diakomodir dengan pendekatan index manual seperti
ini — kalau peserta > 5 orang, kolom Lampiran akan kehabisan baris; kalau
< 5 orang, muncul baris kosong dengan cuma nomor urut doang.

## Solusi
`docxtemplater` (versi yang dipakai di proyek ini, dimuat via CDN sebagai
`window.Docxtemplater`) sudah mendukung **loop di baris tabel** secara
built-in tanpa modul tambahan — taruh tag pembuka di sel pertama baris,
tag penutup di sel terakhir baris yang sama, dan seluruh `<w:tr>` akan
digandakan otomatis sesuai panjang array yang dikirim.

**Penting:** karena proyek ini pakai delimiter custom `{{ }}` (lihat
`generateDocx()` di `js/generate.js`: `delimiters: { start: '{{', end: '}}' }`),
syntax loop-nya **harus dobel kurawal juga**: `{{#peserta_lampiran}}` dan
`{{/peserta_lampiran}}` — BUKAN `{#...}` / `{/...}` single kurawal seperti
di dokumentasi default docxtemplater. Sudah diverifikasi dengan render
test lokal (docxtemplater 3.69.3): pakai single kurawal, tag loop nggak
kebaca sama sekali (cuma jadi teks literal), harus dobel biar match
delimiter custom.

## File yang disertakan
1. **`Surat_Tugas_draft_LAMPIRAN_DINAMIS.docx`** — template hasil edit,
   siap upload ulang ke menu "Kelola Template" (jenis: Surat Tugas).
   Tabel Lampiran sekarang cuma 1 baris "template" berisi:
   `{{#peserta_lampiran}}{{no}}.` | `{{nama}}` | `{{jabatan}}{{/peserta_lampiran}}`
   — baris ini akan digandakan otomatis sesuai jumlah peserta saat
   generate, nggak perlu hardcode 5 baris lagi.
2. **`peserta-lampiran-loop.patch`** — patch kecil untuk `js/generate.js`,
   nambahin array `peserta_lampiran` ke `buildBaseArgs()` supaya semua
   jenis dokumen (SPPD, Surat Tugas, dll — karena semua manggil
   `buildBaseArgs()`) otomatis dapat argument ini tanpa perlu diedit
   terpisah per jenis dokumen.

## Instruksi

1. Pastikan posisi kerja di root repo `SPPD`.
2. Apply patch:

   ```bash
   git apply peserta-lampiran-loop.patch
   ```

   Kalau gagal whitespace, coba `git apply --whitespace=fix peserta-lampiran-loop.patch`.
   Kalau context mismatch, terapkan manual: di `buildBaseArgs()`
   (`js/generate.js`), setelah blok `pesertaIndexed` (sebelum `rekapN`),
   tambah:

   ```js
   const pesertaLampiran = sorted.map((ps, i) => {
     const pgw = getPegawaiById(ps.pegawai_id);
     return { no: i + 1, nama: pgw?.nama_lengkap || '', jabatan: pgw?.jabatan || '' };
   });
   ```

   lalu di object return, tambah key `peserta_lampiran: pesertaLampiran,`
   di dekat `...pesertaIndexed,`.

3. File yang kena dampak: **cuma `js/generate.js`** (1 array baru + 1 key
   di return object, tidak ada logic lain yang berubah).

4. Setelah apply:
   ```bash
   node -c js/generate.js
   ```

5. Upload `Surat_Tugas_draft_LAMPIRAN_DINAMIS.docx` sebagai template baru
   (atau replace template lama) jenis **Surat Tugas** di menu Kelola
   Template. Placeholder lain di template ini (`{{nomor}}`, `{{dasar}}`,
   `{{deskripsi_tugas}}`, `{{hari_tanggal_tugas}}`, `{{tujuan}}`,
   `{{kota}}`, `{{tanggal_surat}}`, `{{nama_kepala}}`, `{{nip_kepala}}`)
   tidak diubah sama sekali — hanya tabel Lampiran yang diedit.

6. Smoke test: buat/pilih perjalanan dinas dengan 1 peserta → generate
   Surat Tugas → tabel Lampiran cuma 1 baris. Ganti ke perjalanan dengan
   4–5 peserta → tabel otomatis jadi 4–5 baris, nomor dan jabatan terisi
   benar per orang. Kalau 0 peserta, tabel jadi kosong (cuma header) —
   pastikan minimal 1 peserta selalu diisi di form (biasanya sudah
   wajib).

## Catatan tambahan (di luar scope, cuma info)
Halaman Panduan (`js/pages.js`) mendokumentasikan argument
`{{peserta_table}}` sebagai "Computed — tabel otomatis", tapi
`buildBaseArgs()` di `js/generate.js` **tidak pernah benar-benar
mengisi key ini**. Kalau ada template lain yang masih pakai
`{{peserta_table}}` mengharapkan tabel jadi, itu nggak akan pernah
terisi — kemungkinan dokumentasi lama yang belum diimplementasi.
Di luar scope patch ini, tapi worth diketahui kalau ada laporan serupa
di template lain.

## Selesai kalau
- Patch ke-apply bersih (atau perubahan manual setara), `node -c` tidak error.
- Template baru diupload, generate Surat Tugas dengan jumlah peserta
  berbeda-beda menghasilkan tabel Lampiran yang jumlah barisnya ikut
  menyesuaikan otomatis.
