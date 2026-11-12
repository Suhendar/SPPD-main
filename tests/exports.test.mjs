import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const KEYWORDS = new Set(
  'if,for,while,switch,catch,function,return,typeof,new,in,of,do,else,try,finally,await,async,yield,delete,void,instanceof,this,true,false,null,undefined,var,let,const,class,extends,super,import,export,default,case,break,continue,throw,with,debugger'.split(','),
);
// Nama yang wajar muncul di value handler tapi bukan global: method/keyword/builtin.
const ALLOW = new Set([
  'this', 'event', 'document', 'if', 'true', 'false', 'checked', 'value', 'id',
  'closest', 'remove', 'querySelector', 'getElementById', 'toLowerCase',
  'stopPropagation', 'openAdjustment', 'openHistory', 'openPagu', 'savePagu',
  'saveAdjustment', 'reverseAdjustment', 'migrateLegacyFinals', 'renderDashboard',
]);

function read(f) {
  return readFileSync(join(root, f), 'utf8');
}

function jsList() {
  return [
    ...readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
    'upgrade/js/anggaran.js',
  ];
}

// Ambil SELURUH isi value atribut on* (semua gaya quote, termasuk escaped),
// lalu pungut semua panggilan fungsi di dalamnya — bukan cuma yang di awal.
function handlerNames(src) {
  const out = new Set();
  const re = /on(?:click|change|input|submit|keyup)\s*=\s*(\\?["'])/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const raw = m[1];
    const q = raw.replace('\\', '');
    const esc = raw.startsWith('\\');
    let j = m.index + m[0].length;
    let val = '';
    while (j < src.length) {
      const c = src[j];
      if (c === '\\' && src[j + 1] === q) {
        val += c + src[j + 1];
        j += 2;
        continue;
      }
      if (c === q && (esc || src[j - 1] !== '\\')) break;
      val += c;
      j += 1;
    }
    // Abaikan method call (objeknya yang wajib global, mis. Anggaran.x / Auth.x).
    for (const c of val.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (c.index > 0 && val[c.index - 1] === '.') continue;
      out.add(c[1]);
    }
    re.lastIndex = j + 1;
  }
  return out;
}

function providedGlobals() {
  const got = new Set(['SPPD_CONFIG', 'Anggaran']);
  for (const f of jsList()) {
    const src = read(f);
    for (const m of src.matchAll(/Object\.assign\(globalThis,\s*\{([^}]+)\}/g)) {
      for (const n of m[1].matchAll(/[A-Za-z_$][\w$]*/g)) got.add(n[0]);
    }
  }
  return got;
}

describe('IIFE exports', () => {
  it('semua fungsi yang dipanggil dari handler on* terdaftar global', () => {
    const provided = providedGlobals();
    const missing = [];
    for (const f of [...jsList(), 'index.html', 'login.html']) {
      for (const name of handlerNames(read(f))) {
        if (KEYWORDS.has(name) || ALLOW.has(name) || provided.has(name)) continue;
        missing.push(`${f}: ${name}`);
      }
    }
    assert.deepEqual(missing, [], `handler memanggil global yang tidak diekspor:\n${missing.join('\n')}`);
  });
});
