import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = () => readFileSync(join(root, 'login.html'), 'utf8');

describe('login single-entry', () => {
  it('tanpa tab bar ganda (satu pintu masuk saja)', () => {
    const src = html();
    assert.ok(!src.includes('login-tabs'), 'login-tabs harus dibuang (sisa tab Masuk dobel)');
    assert.ok(!src.includes('login-tab'), 'login-tab harus dibuang');
    assert.ok(!src.includes("querySelectorAll('.login-tab')"), 'JS tab-switching mati harus dibuang');
  });

  it('satu tombol submit Masuk', () => {
    const src = html();
    const submits = [...src.matchAll(/<button[^>]*type="submit"[^>]*>([\s\S]*?)<\/button>/g)];
    assert.equal(submits.length, 1, 'harus tepat satu tombol submit');
    assert.ok(submits[0][1].includes('Masuk'), 'tombol submit harus bertuliskan Masuk');
  });
});
