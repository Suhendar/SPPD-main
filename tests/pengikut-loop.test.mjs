import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Ambil satu file dari zip TANPA dependensi (stored/deflated, size di local header).
function zipRead(buf, name) {
  let off = 0;
  while (off + 30 <= buf.length) {
    if (buf.readUInt32LE(off) !== 0x04034b50) break;
    const method = buf.readUInt16LE(off + 8);
    const csize = buf.readUInt32LE(off + 18);
    const fnLen = buf.readUInt16LE(off + 26);
    const exLen = buf.readUInt16LE(off + 28);
    const fname = buf.toString('utf8', off + 30, off + 30 + fnLen);
    const start = off + 30 + fnLen + exLen;
    const data = buf.subarray(start, start + csize);
    if (fname === name) {
      if (method === 0) return Buffer.from(data);
      if (method === 8) return Buffer.from(inflateRawSync(data));
      throw new Error(`metode zip tak dikenal: ${method}`);
    }
    off = start + csize;
  }
  throw new Error(`tidak ketemu di zip: ${name}`);
}

function templateText() {
  const buf = readFileSync(join(root, 'templates/SPPD_draft_Multi_V1.4.4.docx'));
  const xml = zipRead(buf, 'word/document.xml').toString('utf8');
  // gabung isi <w:t> agar tag yang terbelah jadi beberapa run oleh Word tetap kebaca
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join('');
}

// Muat js/generate.js apa adanya dengan stub global minimal, kembalikan buildBaseArgs.
function loadBuildBaseArgs(pegawai) {
  const byId = Object.fromEntries(pegawai.map((p) => [p.id, p]));
  const rank = { 'IV/b': 42, 'IV/a': 41, 'III/d': 34, 'III/c': 33 };
  const sandbox = {
    console,
    DB: {
      getArr: (k) => (k === 'sppd_unit_kerja' ? [{ kota: 'Cibinong' }] : []),
      get: () => ({}),
    },
    getPegawaiById: (id) => byId[id] || null,
    golonganToNum: (g) => rank[g] || 0,
    hitungLama: () => 2,
    formatTanggal: (s) => s || '',
    terbilangHari: (n) => `${n} Hari`,
    formatRupiah: (n) => `Rp${n}`,
    terbilang: (s) => `${s} Rupiah`,
    formatNominalDoc: (n) => String(n),
    getSipdById: () => null,
    getTingkatBiaya: () => 'Luar Kota',
    getKecById: () => null,
    formatJam: () => '',
    formatHariTanggalTugas: () => 'Hari/Tanggal',
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, 'js/generate.js'), 'utf8'), sandbox, {
    filename: 'generate.js',
  });
  return vm.runInContext('buildBaseArgs', sandbox);
}

function fakePJD(n) {
  const pegawai = Array.from({ length: n }, (_, i) => ({
    id: `pgw${i + 1}`,
    nama_lengkap: `Peserta ${i + 1}`,
    nip: `111${i + 1}`,
    pangkat: 'Pembina',
    golongan: i % 2 ? 'IV/a' : 'III/d',
    pangkat_golongan: i % 2 ? 'Pembina / IV/a' : 'Penata / III/d',
    jabatan: `Jabatan ${i + 1}`,
  }));
  return {
    pegawai,
    pjd: {
      nomor_surat: '800/123',
      tanggal_berangkat: '2026-01-01',
      tanggal_kembali: '2026-01-02',
      jenis_perjalanan: 'luar_kota',
      alamat_tujuan: 'Bandung',
      maksud_perjalanan: 'Rapat',
      dasar: 'Undangan',
      alat_angkutan: 'Mobil Dinas',
      peserta: pegawai.map((p) => ({ pegawai_id: p.id })),
    },
  };
}

describe('pengikut SPPD maks 5 per tabel (grup @6)', () => {
  it('template Multi: tiap tabel 1 utama + loop pengikut, diulang per grup', () => {
    const xml = templateText();
    assert.match(xml, /\{\{#sppd_groups\}\}/);
    assert.match(xml, /\{\{\/sppd_groups\}\}/);
    assert.match(xml, /\{\{#pengikut\}\}/);
    assert.match(xml, /\{\{\/pengikut\}\}/);
    // tag buka nempel ke {{nama}} (sel nomor kosong, ga makan tempat)
    assert.match(xml, /\{\{#pengikut\}\}\{\{nama\}\}/);
    assert.match(xml, /\{\{nama_utama\}\}/);
    assert.match(xml, /\{\{pangkat_gol_utama\}\}/);
    assert.match(xml, /\{\{jabatan_utama\}\}/);
    for (const tag of ['nama_peserta_', 'pangkat_gol_peserta_', 'jabatan_peserta_', 'pengikut_lampiran']) {
      assert.doesNotMatch(xml, new RegExp(tag));
    }
  });

  it('buildBaseArgs: 15 peserta -> 3 grup [6,6,3], pengikut <= 5, urutan utuh', () => {
    const { pegawai, pjd } = fakePJD(15);
    const args = loadBuildBaseArgs(pegawai)(pjd);
    assert.equal(args.sppd_groups.length, 3);
    assert.equal(
      args.sppd_groups.map((g) => 1 + g.pengikut.length).join(','),
      '6,6,3',
    );
    for (const g of args.sppd_groups) {
      assert.ok(g.pengikut.length <= 5, 'maks 5 pengikut per tabel');
      assert.ok(g.nama_utama, 'nama utama terisi');
      for (const r of g.pengikut) {
        assert.ok(r.nama && r.pangkat_gol && r.jabatan, 'pengikut lengkap');
      }
    }
    const flat = args.sppd_groups.flatMap((g) => [
      g.nama_utama,
      ...g.pengikut.map((r) => r.nama),
    ]);
    assert.equal(flat.join('|'), args.peserta_lampiran.map((r) => r.nama).join('|'));
    // kompatibel ke belakang
    assert.equal(args.peserta_lampiran.length, 15);
    assert.equal(args.pengikut_lampiran.length, 14);
    assert.ok(args.nama_peserta_15, 'slot _15 ikut terisi');
  });

  it('buildBaseArgs: 7 peserta -> 2 grup, grup 2 tanpa pengikut', () => {
    const { pegawai, pjd } = fakePJD(7);
    const args = loadBuildBaseArgs(pegawai)(pjd);
    assert.equal(args.sppd_groups.length, 2);
    assert.equal(args.sppd_groups[0].pengikut.length, 5);
    assert.equal(args.sppd_groups[1].pengikut.length, 0);
    assert.ok(args.sppd_groups[1].nama_utama);
  });

  it('buildBaseArgs: 1 peserta -> 1 grup tanpa pengikut', () => {
    const { pegawai, pjd } = fakePJD(1);
    const args = loadBuildBaseArgs(pegawai)(pjd);
    assert.equal(args.sppd_groups.length, 1);
    assert.equal(args.sppd_groups[0].pengikut.length, 0);
  });
});
