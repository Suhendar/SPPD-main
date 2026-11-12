import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function jsFiles(dir) {
  return readdirSync(join(root, dir))
    .filter((f) => f.endsWith('.js'))
    .map((f) => join(dir, f));
}

const files = [...jsFiles('js'), ...jsFiles('api'), ...jsFiles('scripts')];

describe('syntax', () => {
  for (const f of files) {
    it(`${f} lolos node --check`, () => {
      if (f.startsWith('api/')) {
        execFileSync(
          process.execPath,
          ['--input-type=module', '--check'],
          { input: readFileSync(join(root, f), 'utf8'), stdio: ['pipe', 'pipe', 'pipe'] },
        );
      } else {
        execFileSync(process.execPath, ['--check', join(root, f)], { stdio: ['pipe', 'pipe', 'pipe'] });
      }
    });
  }

  it('scripts/dev-server.py kompilasi bersih', () => {
    execFileSync('python3', ['-m', 'py_compile', join(root, 'scripts/dev-server.py')], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  });

  it('login internal-only: tanpa form pendaftaran publik', () => {
    const html = readFileSync(join(root, 'login.html'), 'utf8');
    assert.ok(!html.includes('form-signup'), 'form-signup harus dibuang');
    assert.ok(!html.includes('pane-signup'), 'pane-signup harus dibuang');
    assert.ok(!html.includes('data-tab="signup"'), 'tab Daftar harus dibuang');
  });

  it('escapeHtml ada dan netral untuk teks biasa', () => {
    const src = readFileSync(join(root, 'js/app.js'), 'utf8');
    const m = src.match(/function escapeHtml\(s\) \{[\s\S]*?\n\}/);
    assert.ok(m, 'escapeHtml tidak ditemukan di js/app.js');
    const escapeHtml = new Function(`${m[0]}; return escapeHtml;`)();
    assert.equal(escapeHtml('Rheza Reynaldi, S.T.'), 'Rheza Reynaldi, S.T.');
    assert.ok(!/[<>"]/.test(escapeHtml(`"><img src=x onerror=alert(1)>`)));
  });
});
