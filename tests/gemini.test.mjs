import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/gemini.js';

const realFetch = globalThis.fetch;

function mockRes() {
  const r = { statusCode: 200, body: null };
  r.setHeader = () => {};
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (o) => { r.body = o; return r; };
  r.end = () => r;
  return r;
}

function call(body, headers = {}) {
  const res = mockRes();
  return handler({ method: 'POST', headers, body }, res).then(() => res);
}

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://xyz.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  process.env.GEMINI_API_KEY = 'test-key';
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('auth gate', () => {
  it('401 tanpa token, Gemini tidak dipanggil', async () => {
    let geminiCalled = false;
    globalThis.fetch = async (url) => {
      if (String(url).includes('google')) geminiCalled = true;
      return { ok: true, status: 200, json: async () => ({}) };
    };
    const res = await call({ mode: 'nota_dinas', pelaksanaan: 'X' });
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'Login diperlukan untuk memakai fitur AI.');
    assert.equal(geminiCalled, false);
  });

  it('401 token basi', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
    const res = await call(
      { mode: 'nota_dinas', pelaksanaan: 'X' },
      { authorization: 'Bearer stale-token' },
    );
    assert.equal(res.statusCode, 401);
  });

  it('413 body kebesaran', async () => {
    globalThis.fetch = async (url) => {
      if (String(url).includes('/auth/v1/user')) {
        return { ok: true, status: 200, json: async () => ({ id: 'u1' }) };
      }
      throw new Error('Gemini must not be called for oversize body');
    };
    const res = await call(
      { mode: 'nota_dinas', pelaksanaan: 'x'.repeat(21000) },
      { authorization: 'Bearer good-token' },
    );
    assert.equal(res.statusCode, 413);
  });
});

describe('mode nota_dinas', () => {
  function authGeminiStub(reply) {
    return async (url) => {
      if (String(url).includes('/auth/v1/user')) {
        return { ok: true, status: 200, json: async () => ({ id: 'u1' }) };
      }
      if (String(url).includes('/rest/v1/sppd_ai_usage')) {
        if (url.includes('select=count')) {
          return { ok: true, status: 200, json: async () => [] };
        }
        return { ok: true, status: 201, json: async () => ({}) };
      }
      return reply;
    };
  }

  it('400 tanpa pelaksanaan', async () => {
    globalThis.fetch = authGeminiStub({ ok: true, json: async () => ({}) });
    const res = await call({ mode: 'nota_dinas' }, { authorization: 'Bearer t' });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /pelaksanaan/);
  });

  it('200 hasil + kesimpulan dari JSON Gemini', async () => {
    globalThis.fetch = authGeminiStub({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"hasil": "H", "kesimpulan": "K"}' }] } }],
      }),
    });
    const res = await call(
      { mode: 'nota_dinas', hal: 'Laporan', pelaksanaan: 'Kegiatan X.' },
      { authorization: 'Bearer good-token' },
    );
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { hasil: 'H', kesimpulan: 'K' });
  });

  it('fallback saat kuota 429', async () => {
    globalThis.fetch = authGeminiStub({
      ok: false, status: 429, text: async () => 'quota',
    });
    const res = await call(
      { mode: 'nota_dinas', hal: 'Laporan X', pelaksanaan: 'Kegiatan Y.' },
      { authorization: 'Bearer good-token' },
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.fallback, true);
    assert.ok(res.body.hasil);
    assert.ok(res.body.kesimpulan);
  });
});

describe('CORS ketat', () => {
  it('403 untuk Origin asing', async () => {
    let geminiCalled = false;
    globalThis.fetch = async () => {
      geminiCalled = true;
      return { ok: true, status: 200, json: async () => ({}) };
    };
    const res = await call(
      { mode: 'nota_dinas', pelaksanaan: 'X' },
      { authorization: 'Bearer t', origin: 'https://evil.example', host: 'sppd.vercel.app' },
    );
    assert.equal(res.statusCode, 403);
    assert.equal(geminiCalled, false);
  });

  it('preflight lolos untuk host yang sama', async () => {
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
    const res = mockRes();
    await handler(
      { method: 'OPTIONS', headers: { origin: 'https://sppd.vercel.app', host: 'sppd.vercel.app' }, body: {} },
      res,
    );
    assert.equal(res.statusCode, 200);
  });
});

describe('rate limit + audit', () => {
  function usageStub({ usageCount, tableMissing = false }) {
    return async (url) => {
      if (String(url).includes('/auth/v1/user')) {
        return { ok: true, status: 200, json: async () => ({ id: 'u1' }) };
      }
      if (String(url).includes('/rest/v1/sppd_ai_usage')) {
        if (tableMissing) return { ok: false, status: 404, json: async () => ({}) };
        if (url.includes('select=count')) {
          return { ok: true, status: 200, json: async () => (usageCount > 0 ? [{ count: usageCount }] : []) };
        }
        return { ok: true, status: 201, json: async () => ({}) };
      }
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"hasil": "H", "kesimpulan": "K"}' }] } }],
        }),
      };
    };
  }

  it('429 saat kuota harian habis', async () => {
    process.env.AI_DAILY_LIMIT = '30';
    globalThis.fetch = usageStub({ usageCount: 30 });
    const res = await call(
      { mode: 'nota_dinas', pelaksanaan: 'X' },
      { authorization: 'Bearer good-token' },
    );
    assert.equal(res.statusCode, 429);
    assert.match(res.body.error, /Batas pemakaian AI/);
  });

  it('200 + catat pemakaian saat kuota tersedia', async () => {
    process.env.AI_DAILY_LIMIT = '30';
    let wrote = false;
    const base = usageStub({ usageCount: 5 });
    globalThis.fetch = async (url, opts) => {
      if (String(url).includes('/rest/v1/sppd_ai_usage') && opts?.method === 'POST') wrote = true;
      return base(url, opts);
    };
    const res = await call(
      { mode: 'nota_dinas', pelaksanaan: 'X' },
      { authorization: 'Bearer good-token' },
    );
    assert.equal(res.statusCode, 200);
    assert.equal(wrote, true);
  });

  it('model 404 dilompati ke model berikut', async () => {
    const seen = [];
    globalThis.fetch = async (url, opts) => {
      if (String(url).includes('/auth/v1/user')) {
        return { ok: true, status: 200, json: async () => ({ id: 'u1' }) };
      }
      if (String(url).includes('/rest/v1/sppd_ai_usage')) {
        return { ok: true, status: url.includes('select=count') ? 200 : 201, json: async () => [] };
      }
      seen.push(url);
      if (String(url).includes('gemini-3.6-flash')) {
        return { ok: false, status: 404, text: async () => 'model not found' };
      }
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"hasil": "H", "kesimpulan": "K"}' }] } }],
        }),
      };
    };
    const res = await call(
      { mode: 'nota_dinas', pelaksanaan: 'X' },
      { authorization: 'Bearer good-token' },
    );
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { hasil: 'H', kesimpulan: 'K' });
    assert.ok(seen.some((u) => u.includes('gemini-3.8-flash')));
  });

  it('502 jelas saat semua model tidak dikenal', async () => {
    globalThis.fetch = async (url) => {
      if (String(url).includes('/auth/v1/user')) {
        return { ok: true, status: 200, json: async () => ({ id: 'u1' }) };
      }
      if (String(url).includes('/rest/v1/sppd_ai_usage')) {
        return { ok: true, status: url.includes('select=count') ? 200 : 201, json: async () => [] };
      }
      return { ok: false, status: 404, text: async () => 'model not found' };
    };
    const res = await call(
      { mode: 'nota_dinas', pelaksanaan: 'X' },
      { authorization: 'Bearer good-token' },
    );
    assert.equal(res.statusCode, 502);
    assert.match(res.body.error, /GEMINI_MODEL/);
  });

  it('500 jelas saat tabel belum disiapkan', async () => {
    globalThis.fetch = usageStub({ usageCount: 0, tableMissing: true });
    const res = await call(
      { mode: 'nota_dinas', pelaksanaan: 'X' },
      { authorization: 'Bearer good-token' },
    );
    assert.equal(res.statusCode, 500);
    assert.match(res.body.error, /ai_usage/);
  });
});

describe('mode lama tidak berubah', () => {
  it('400 tanpa keperluan', async () => {
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ id: 'u1' }) });
    const res = await call({ mode: 'baru' }, { authorization: 'Bearer t' });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /keperluan/);
  });
});
