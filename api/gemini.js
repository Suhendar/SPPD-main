/**
 * api/gemini.js — Vercel Serverless Function
 * Proxy ke Gemini API, menjaga API key tetap di server
 *
 * Env var yang dibutuhkan di Vercel:
 *   GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY (wajib)
 *   AI_DAILY_LIMIT (opsional, default 30), ALLOWED_ORIGINS (opsional),
 *   GEMINI_MODEL (opsional, default coba gemini-3.6-flash lalu 3.8-flash)
 *
 * POST /api/gemini — header Authorization: Bearer <supabase access_token>
 * Body lama: { mode, keperluan, ... } → { dasar, deskripsi_tugas }
 * Body nota: { mode:'nota_dinas', hal, dasar_hukum, pelaksanaan, ... }
 *   → { hasil, kesimpulan }
 * Rate limit + audit: tabel public.sppd_ai_usage (lihat supabase/ai_usage.sql)
 */

export default async function handler(req, res) {
  // ─── CORS KETAT ───────────────────────────────────────────
  // Tanpa Origin (curl/server) lolos; browser wajib dari host yang sama
  // atau dari daftar ALLOWED_ORIGINS (koma).
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const reqOrigin = req.headers.origin || '';
  let originOk = true;
  if (reqOrigin) {
    try {
      const oHost = new URL(reqOrigin).hostname;
      const hHost = (req.headers.host || '').split(':')[0];
      originOk = oHost === hHost || ALLOWED_ORIGINS.includes(reqOrigin);
    } catch {
      originOk = false;
    }
  }
  if (reqOrigin) {
    res.setHeader('Vary', 'Origin');
    if (originOk) res.setHeader('Access-Control-Allow-Origin', reqOrigin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return originOk
      ? res.status(200).end()
      : res.status(403).json({ error: 'Origin tidak diizinkan.' });
  }
  if (!originOk) return res.status(403).json({ error: 'Origin tidak diizinkan.' });
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // ─── USER AUTH ────────────────────────────────────────────
  // Wajib login: hanya user terdaftar yang boleh memakai kuota Gemini pemilik.
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Backend auth belum dikonfigurasi di Vercel' });
  }
  const authHeader = req.headers.authorization || '';
  const userToken = authHeader.replace(/^[Bb]earer\s+/, '');
  if (!userToken) {
    return res.status(401).json({ error: 'Login diperlukan untuk memakai fitur AI.' });
  }
  let userId = null;
  try {
    const meRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${userToken}` },
    });
    if (meRes.status === 401 || meRes.status === 403) {
      return res.status(401).json({ error: 'Sesi berakhir atau tidak valid. Login ulang.' });
    }
    if (!meRes.ok) {
      return res.status(502).json({ error: 'Gagal memverifikasi sesi. Coba lagi.' });
    }
    const meData = await meRes.json().catch(() => ({}));
    userId = meData?.id || null;
    if (!userId) {
      return res.status(502).json({ error: 'Gagal memverifikasi sesi. Coba lagi.' });
    }
  } catch {
    return res.status(502).json({ error: 'Gagal memverifikasi sesi. Coba lagi.' });
  }

  // ─── BODY SIZE GUARD ──────────────────────────────────────
  if (JSON.stringify(req.body || {}).length > 20000) {
    return res.status(413).json({ error: 'Input terlalu besar.' });
  }

  // ─── API KEY CHECK ────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi di Vercel' });

  // ─── PARSE BODY ───────────────────────────────────────────
  const body = req.body || {};
  const { mode, keperluan, tujuan_instansi, peserta, tanggal, teks_existing } = body;
  const { hal, dasar_hukum, pelaksanaan, tujuan } = body;
  if (mode === 'nota_dinas') {
    if (!pelaksanaan) return res.status(400).json({ error: 'Field "pelaksanaan" wajib diisi' });
  } else if (!keperluan) {
    return res.status(400).json({ error: 'Field "keperluan" wajib diisi' });
  }

  // ─── BUILD PROMPT ─────────────────────────────────────────
  const prompt = buildPrompt({ mode, keperluan, tujuan_instansi, peserta, tanggal, teks_existing, hal, dasar_hukum, pelaksanaan, tujuan });

  // ─── RATE LIMIT + AUDIT ───────────────────────────────────
  // Hitung per user per hari di public.sppd_ai_usage (trigger DB memaksa
  // count naik tepat +1 tiap tulis — user tidak bisa reset kuotanya sendiri).
  const AI_DAILY_LIMIT = parseInt(process.env.AI_DAILY_LIMIT || '30', 10);
  const todayId = new Date().toISOString().slice(0, 10);
  const restHeaders = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${userToken}`,
    'Content-Type': 'application/json',
  };
  const usageUrl = `${supabaseUrl}/rest/v1/sppd_ai_usage?user_id=eq.${userId}&day=eq.${todayId}&select=count`;
  try {
    const uRes = await fetch(usageUrl, { headers: restHeaders });
    if (uRes.status === 404) {
      return res.status(500).json({ error: 'Tabel sppd_ai_usage belum disiapkan. Jalankan supabase/ai_usage.sql lalu coba lagi.' });
    }
    if (!uRes.ok) throw new Error('usage read failed');
    const rows = await uRes.json().catch(() => []);
    const used = Array.isArray(rows) && rows[0] ? (rows[0].count || 0) : 0;
    if (used >= AI_DAILY_LIMIT) {
      return res.status(429).json({ error: `Batas pemakaian AI harian tercapai (${AI_DAILY_LIMIT}x/hari). Coba lagi besok.` });
    }
    const wRes = await fetch(`${supabaseUrl}/rest/v1/sppd_ai_usage`, {
      method: 'POST',
      headers: { ...restHeaders, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ user_id: userId, day: todayId, last_at: new Date().toISOString(), last_mode: mode || 'baru' }),
    });
    if (wRes.status === 404) {
      return res.status(500).json({ error: 'Tabel sppd_ai_usage belum disiapkan. Jalankan supabase/ai_usage.sql lalu coba lagi.' });
    }
    if (!wRes.ok) throw new Error('usage write failed');
  } catch (err) {
    console.warn('AI usage check:', err.message);
    return res.status(502).json({ error: 'Gagal memeriksa kuota AI. Coba lagi.' });
  }

  // ─── CALL GEMINI ──────────────────────────────────────────
  // Google mempensiunkan nama model dari waktu ke waktu (404 = model tidak
  // dikenal). Coba daftar model berurutan; env GEMINI_MODEL selalu pertama
  // agar admin bisa mengunci model aktif tanpa edit kode.
  const GEMINI_MODELS = [...new Set(
    [process.env.GEMINI_MODEL, 'gemini-3.6-flash', 'gemini-3.8-flash']
      .filter(Boolean)
  )];
  const geminiPayload = (text) => ({
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  let geminiRes = null;
  let lastModelErr = '';
  try {
    for (const model of GEMINI_MODELS) {
      const attempt = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload(prompt)),
        }
      );
      if (attempt.status === 404) {
        lastModelErr = await attempt.text().catch(() => '');
        console.warn(`Gemini model not found, trying next: ${model}`);
        continue;
      }
      geminiRes = attempt;
      break;
    }
    if (!geminiRes) {
      console.warn('Gemini error:', lastModelErr);
      return res.status(502).json({
        error: `Model AI tidak dikenal (${GEMINI_MODELS.join(', ')}). Cek nama model aktif di Google AI Studio lalu set env GEMINI_MODEL.`,
      });
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.warn('Gemini error:', errText);

      if (geminiRes.status === 429) {
        const fallback = buildFallbackDraft({ mode, keperluan, tujuan_instansi, peserta, tanggal, teks_existing, hal, dasar_hukum, pelaksanaan, tujuan });
        return res.status(200).json({
          ...fallback,
          fallback: true,
          warning: 'Kuota Gemini sedang penuh. Draft sementara dibuat otomatis dan bisa diedit.',
        });
      }

      return res.status(geminiRes.status >= 400 && geminiRes.status < 500 ? geminiRes.status : 502).json({
        error: getGeminiErrorMessage(geminiRes.status),
      });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Parse JSON dari Gemini
    let parsed;
    try {
      parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    } catch {
      return res.status(502).json({ error: 'Gemini mengembalikan format tidak valid', raw: rawText });
    }

    if (mode === 'nota_dinas') {
      if (!parsed.hasil || !parsed.kesimpulan) {
        return res.status(502).json({ error: 'Respons Gemini tidak lengkap', raw: rawText });
      }
      return res.status(200).json({
        hasil      : parsed.hasil.trim(),
        kesimpulan : parsed.kesimpulan.trim(),
      });
    }

    if (!parsed.dasar || !parsed.deskripsi_tugas) {
      return res.status(502).json({ error: 'Respons Gemini tidak lengkap', raw: rawText });
    }

    return res.status(200).json({
      dasar           : parsed.dasar.trim(),
      deskripsi_tugas : parsed.deskripsi_tugas.trim(),
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function getGeminiErrorMessage(status) {
  if (status === 400) return 'Permintaan ke Gemini tidak valid. Coba ringkas input lalu generate ulang.';
  if (status === 401 || status === 403) return 'API key Gemini belum valid atau tidak punya akses.';
  if (status === 429) return 'Kuota Gemini sedang penuh. Coba lagi beberapa saat.';
  if (status >= 500) return 'Layanan Gemini sedang bermasalah. Coba lagi nanti.';
  return `Gemini belum bisa memproses permintaan saat ini. Kode: ${status}`;
}

function buildFallbackDraft({ mode, keperluan, tujuan_instansi, peserta, tanggal, teks_existing, hal }) {
  const tujuan = tujuan_instansi || 'instansi terkait';
  const waktu = tanggal || 'waktu yang telah ditentukan';
  const pesertaNames = Array.isArray(peserta) && peserta.length
    ? peserta.map(p => p.nama).filter(Boolean).join(', ')
    : 'pegawai yang ditugaskan';

  if (mode === 'nota_dinas') {
    const topik = hal || 'kegiatan tersebut';
    return {
      hasil: `Berdasarkan pelaksanaan ${topik}, peserta memperoleh pemahaman mengenai materi yang disampaikan serta manfaat kegiatan bagi peningkatan kesadaran dan kedisiplinan dalam pelaksanaan tugas kedinasan.`,
      kesimpulan: `${topik} telah terlaksana dengan baik dan memberikan manfaat bagi peserta. Disarankan agar tindak lanjut kegiatan dapat diterapkan secara berkelanjutan di lingkungan kerja.`,
    };
  }

  if (mode === 'perbaiki' && teks_existing) {
    return {
      dasar: `Dalam rangka pelaksanaan tugas kedinasan terkait ${keperluan}, diperlukan penugasan kepada ${pesertaNames} untuk melaksanakan kegiatan pada ${tujuan}.`,
      deskripsi_tugas: `${teks_existing.trim()}\n\nMelaksanakan koordinasi dan/atau kegiatan terkait ${keperluan} pada ${tujuan} pada ${waktu}. Melaporkan pelaksanaan kegiatan kepada pimpinan.`,
    };
  }

  return {
    dasar: `Dalam rangka pelaksanaan program kerja dinas terkait ${keperluan}, diperlukan penugasan kepada ${pesertaNames} untuk melaksanakan kegiatan pada ${tujuan}.`,
    deskripsi_tugas: `Melaksanakan ${keperluan} pada ${tujuan} pada ${waktu}. Pegawai yang ditugaskan agar melaksanakan kegiatan dengan penuh tanggung jawab serta berkoordinasi dengan pihak terkait. Melaporkan pelaksanaan kegiatan kepada pimpinan.`,
  };
}

// ─── PROMPT BUILDER ───────────────────────────────────────
function buildPrompt({ mode, keperluan, tujuan_instansi, peserta, tanggal, teks_existing, hal, dasar_hukum, pelaksanaan, tujuan }) {
  const pesertaStr = Array.isArray(peserta) && peserta.length
    ? peserta.map((p, i) => `${i + 1}. ${p.nama} (${p.jabatan || p.golongan || '—'})`).join('\n')
    : 'Tidak disebutkan';

  if (mode === 'nota_dinas') {
    return `Kamu adalah asisten penulisan nota dinas pemerintah Indonesia.
Susun bagian HASIL dan KESIMPULAN untuk laporan nota dinas dari pelaksanaan kegiatan berikut, memakai bahasa Indonesia yang baku dan formal sesuai gaya laporan kedinasan.

Konteks kegiatan:
- Hal: ${hal || 'Tidak disebutkan'}
- Dasar hukum: ${dasar_hukum || 'Tidak disebutkan'}
- Pelaksanaan: ${pelaksanaan || 'Tidak disebutkan'}
- Tanggal: ${tanggal || 'Tidak disebutkan'}
- Tempat: ${tujuan || 'Tidak disebutkan'}

Hasilkan HANYA JSON berikut tanpa teks lain:
{
  "hasil": "1-2 paragraf temuan dan manfaat kegiatan (faktual, merujuk pada pelaksanaan di atas, tanpa mengarang angka/nama/tanggal baru)",
  "kesimpulan": "1-2 paragraf simpulan kegiatan ditambah saran tindak lanjut yang konkret dan relevan"
}`;
  }

  if (mode === 'perbaiki' && teks_existing) {
    return `Kamu adalah asisten penulisan surat resmi pemerintah Indonesia.
Perbaiki dan formalkan teks berikut menjadi bahasa Indonesia yang baku dan resmi sesuai standar surat pemerintah.

Teks yang perlu diperbaiki:
"${teks_existing}"

Konteks tambahan:
- Keperluan: ${keperluan}
- Tujuan/Instansi tujuan: ${tujuan_instansi || 'Tidak disebutkan'}
- Tanggal pelaksanaan: ${tanggal || 'Tidak disebutkan'}
- Peserta:
${pesertaStr}

Hasilkan HANYA JSON berikut tanpa teks lain:
{
  "dasar": "Teks dasar penugasan yang formal (1-3 kalimat, mengacu pada program kerja dinas dan kegiatan yang relevan)",
  "deskripsi_tugas": "Teks deskripsi lengkap tugas yang diperintahkan (formal, menyebutkan tujuan spesifik, nama instansi tujuan, dan instruksi untuk melaporkan hasil kepada pimpinan)"
}`;
  }

  return `Kamu adalah asisten penulisan surat resmi pemerintah Indonesia.
Buatkan konten untuk Surat Perintah Tugas dengan bahasa Indonesia yang baku dan formal sesuai standar surat dinas pemerintah daerah.

Data perjalanan dinas:
- Keperluan/Kegiatan: ${keperluan}
- Tujuan/Instansi yang dikunjungi: ${tujuan_instansi || 'Tidak disebutkan'}
- Tanggal pelaksanaan: ${tanggal || 'Tidak disebutkan'}
- Pegawai yang ditugaskan:
${pesertaStr}

Hasilkan HANYA JSON berikut tanpa teks lain:
{
  "dasar": "Teks dasar penugasan yang formal (1-3 kalimat, dimulai dengan 'Dalam rangka pelaksanaan...' atau 'Menindaklanjuti...' atau sejenisnya, mengacu pada program kerja dinas)",
  "deskripsi_tugas": "Teks deskripsi lengkap tugas yang diperintahkan (formal, sebutkan kegiatan spesifik, nama instansi tujuan, waktu pelaksanaan, dan diakhiri dengan kalimat 'Melaporkan pelaksanaan kegiatan kepada pimpinan.')"
}`;
}
