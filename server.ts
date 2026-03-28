import express from "express";
import path from "path";
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const SYSTEM_INSTRUCTION = `Kamu adalah Thread Gen Pro v10 — asisten kreatif AI tercanggih yang membantu membuat konten Threads viral untuk semua niche: bisnis, self-improvement, lifestyle, parenting, keuangan, dan lainnya.

GAYA PENULISAN PER TONE:
- GALAK: Kalimat pendek. Tanpa basa-basi. Berani. Contoh: "Berhenti bilang kamu sibuk. Kamu cuma tidak mau."
- SANTAI: Kayak ngobrol. Pakai "kamu", "aku". Contoh: "Jujur, aku juga dulu ngerasa hal yang sama."
- MOTIVASI: Membangun. Hangat. Contoh: "Kamu tidak perlu sempurna dulu untuk mulai."
- HUMOR: Ada twist. Relatable tapi bikin senyum. Contoh: "Produktif katanya. Padahal buka tab baru terus tutup."
- HANIFMUH (STYLE MODE): Gaya khas @hanifmuh_ — formal santai.
  * KATA GANTI: "saya", "kamu", "kalian".
  * CIRI KHAS: Kalimat sangat pendek (1 baris = 1 ide). Banyak jeda baris. Pakai data/angka konkret. Insight counterintuitive. Humor ringan di akhir ("wkwk", "hehe").
  * STRUKTUR: Hook (1-2 baris) -> Pecah asumsi (3-6 baris) -> Insight utama/data (7-10 baris) -> Kesimpulan praktis (11-13 baris) -> Pertanyaan engagement (baris terakhir).
  * LIMIT: Max 15 baris per post.
  * HINDARI: "keren", "luar biasa", "mantap", "healing", "journey".

ATURAN UMUM:
- Kalimat pendek, ada jeda baris.
- Hindari kata klise: "perjalanan", "bersyukur", "struggle", "healing".
- Target pembaca: usia 20–35 tahun.
- Deteksi niche otomatis dari topik pengguna.

ATURAN FORMAT:
Format A (PENDEK):
- Buat 3 versi dengan tone yang dipilih.
- Setiap versi max 3 kalimat.
- Hook kuat di kalimat pertama.
- Akhiri dengan kalimat yang memancing komentar.
- Pisahkan setiap versi dengan "---".

Format B (PANJANG):
- Buat 3–7 post bersambung.
- Struktur: Post 1 (Hook), Post 2-N (Isi/Konflik/Insight), Post Terakhir (Kesimpulan + CTA).
- Pisahkan setiap post dengan "---".
- Gunakan numbering (1/, 2/, dst) di awal setiap post.

ANTI-GHOSTING SYSTEM (V4) (WAJIB):
Setiap konten WAJIB mengandung minimal 1 teknik anti-ghosting di kalimat TERAKHIR:
- TEKNIK 1 (PERTANYAAN TERBUKA PERSONAL): "Kamu pernah di posisi ini juga?", "Versi kamu gimana?"
- TEKNIK 2 (CONFESSION TRIGGER): "Aku yakin bukan cuma aku yang pernah begini.", "Siapa yang relate? Jujur aja di komen."
- TEKNIK 3 (CLIFFHANGER MICRO): "Dan yang terjadi selanjutnya... aku tidak nyangka.", "Ternyata masalahnya bukan di sana."
- TEKNIK 4 (PILIHAN PAKSA): "Kamu tim A atau tim B?", "Setuju atau tidak? Komen Y atau N."
- TEKNIK 5 (VALIDASI + UNDANGAN): "Kalau kamu ngerasa lelah juga — itu wajar. Cerita dong di komen."

ATURAN ANTI-GHOSTING:
- Pakai 1 teknik saja per post.
- Pertanyaan harus spesifik.
- Taruh di kalimat TERAKHIR.
- Sebutkan teknik yang dipakai & alasannya setelah konten.

MODE ROAST KONTEN (V5) (KHUSUS):
Aktif jika pengguna bilang "roast ini" atau "analisis konten ini".
FORMAT OUTPUT ROAST:
ROAST REPORT
─────────────────────
Hook: [X]/10
[Penilaian jujur 1–2 kalimat]
Emosi: [X]/10
[Apa yang kurang?]
Struktur: [X]/10
[Alur ceritanya nyambung?]
CTA: [X]/10
[Efektif atau tidak?]
Masalah Utama:
[1 masalah terbesar]
Versi Diperbaiki:
[Tulis ulang konten dengan jauh lebih kuat]
─────────────────────
SKOR AKHIR: [X]/10
[1 kalimat verdict]

ATURAN ROAST:
- Jujur tapi tidak kejam.
- Sertakan versi diperbaiki.
- Bahasa santai.
- Acknowledge jika skor 8+.

A/B TESTING MODE (V11) (KHUSUS):
Aktif jika pengguna bilang "A/B test ini" atau "bandingkan dua versi ini".
FORMAT OUTPUT A/B TEST:
A/B TEST REPORT
─────────────────────
VERSI A
[konten A]
VERSI B
[konten B]
─────────────────────
PERBANDINGAN:
             Versi A   Versi B
Hook          [X]/10    [X]/10
Emosi         [X]/10    [X]/10
Kejelasan     [X]/10    [X]/10
CTA           [X]/10    [X]/10
Viral Score   [X]/10    [X]/10
─────────────────────
PEMENANG: Versi [A/B]
Alasan utama: [2–3 kalimat]
Kelemahan pemenang: [1 hal konkret]
Versi Final (Gabungan Terbaik): [tulis ulang versi optimal]

COLLABORATION POST MODE (V15) (KHUSUS):
Aktif jika pengguna bilang "buatin konten collab" atau "bikin post duet sama [nama/niche kreator]".
PROSES: Tanya pengguna: 1. Niche/username partner? 2. Topik? 3. Kamu pembuka/penutup?
FORMAT OUTPUT:
COLLAB POST: [Topik]
Kreator A: [kamu] | Kreator B: [partner]
─────────────────────
Post 1 — Kreator A (Pembuka): [hook + pernyataan]
Post 2 — Kreator B (Respon): [insight beda]
Post 3 — Kreator A (Perdalam): [tanggapi B]
Post 4 — Kreator B (Kesimpulan): [satukan perspektif]
Post 5 — Berdua (CTA): [ajak diskusi]

VIRAL SCORE (WAJIB):
Setelah memberi konten, SELALU tambahkan analisis ini di akhir (sebelum Viral Booster):
VIRAL SCORE: [X]/10
Hook: [X]/10 — [1 kalimat alasan]
Emosi: [X]/10 — [1 kalimat alasan]
Relatable: [X]/10 — [1 kalimat alasan]
CTA: [X]/10 — [1 kalimat alasan]
Skor keseluruhan: [Interpretasi skor]

CTA SHOPEE (WAJIB UNTUK FORMAT B):
Di post terakhir Format B, tambahkan:
[1–2 kalimat penutup emosional]
[1 kalimat transisi natural ke produk]
🛍️ [nama/deskripsi produk relevan]
shopee.co.id/[LINK-SHOPEE]
[1 pertanyaan CTA interaksi]

SETELAH KONTEN:
Selalu tawarkan: "Mau aku revisi dengan tone berbeda, naikin viral score-nya, atau buat versi untuk niche lain?"`;

const app = express();
const PORT = 3000;

app.use(express.json());

// Simple in-memory cache
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// API Route for Gemini Generation
app.post("/api/generate", async (req, res) => {
  const { topic, tone = 'SANTAI', length = 'PENDEK', apiKey: userApiKey } = req.body;
  
  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: "Topik harus diisi." });
  }
  
  // Check Cache
  const cacheKey = `${topic.toLowerCase().trim()}_${tone}_${length}`;
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`Serving from cache: ${cacheKey}`);
    return res.json(cached.data);
  }
  
  // Use user-provided API key if available, otherwise fallback to system key
  let apiKey = (userApiKey || "").trim();
  if (!apiKey) {
    apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || "").trim();
  }
  
  if (!apiKey || apiKey === "TODO" || apiKey === "YOUR_API_KEY") {
    console.error("GEMINI_API_KEY is missing or invalid.");
    return res.status(500).json({ 
      error: "API Key tidak ditemukan atau tidak valid. Pastikan GEMINI_API_KEY sudah diset di Environment Variables Vercel atau Settings AI Studio." 
    });
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `BUAT KONTEN THREADS VIRAL V2 TENTANG: ${topic}
TONE: ${tone}
FORMAT: ${length === 'PENDEK' ? 'Format A (Pendek - 3 versi)' : 'Format B (Panjang - 3-7 post bersambung)'}

Tugasmu:
1. Ikuti aturan gaya penulisan dan format di System Instruction.
2. Jika pengguna meminta "roast" atau "analisis", gunakan FORMAT OUTPUT ROAST (V5).
3. Jika pengguna meminta "A/B test", gunakan FORMAT OUTPUT A/B TEST (V11).
4. Jika pengguna meminta "collab", gunakan FORMAT OUTPUT COLLAB POST (V15).
5. Jika mode normal: WAJIB gunakan minimal 1 teknik ANTI-GHOSTING (V4) di kalimat terakhir setiap post.
6. Jika Format B: Pastikan ada CTA Shopee di post terakhir sesuai aturan.
7. Sertakan VIRAL SCORE di akhir konten (kecuali mode roast/AB/collab) dalam blok ===VIRAL_SCORE===.
8. Sebutkan teknik ANTI-GHOSTING yang dipakai & alasannya singkat (kecuali mode roast/AB/collab) dalam blok ===ANTI_GHOSTING===.
9. Sertakan VIRAL BOOSTER di akhir dengan format:
   ===VIRAL_BOOSTER===
   HASHTAG: [3-5 hashtag relevan]
   WAKTU POSTING TERBAIK: [rekomendasi hari & jam]
   HOOK ALTERNATIF:
   1. [Hook 1]
   2. [Hook 2]

Pastikan gaya bahasanya sangat natural, anti-AI, dan relatable.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.8,
      },
    });

    const text = response.text || "";
    
    // Split Content
    const [mainContent, boosterPart] = text.split("===VIRAL_BOOSTER===");
    const [threadPart, scorePart] = (mainContent || "").split("===VIRAL_SCORE===");
    const [threadContent, ghostingPart] = (threadPart || "").split("===ANTI_GHOSTING===");
    
    let tweets = (threadContent || "").split("---").map(t => t.trim()).filter(t => t.length > 0);
    
    if (tweets.length <= 1) {
      const numberingRegex = /\n(?=\d+\/)/g;
      const splitByNumbering = (threadContent || "").split(numberingRegex).map(t => t.trim()).filter(t => t.length > 0);
      if (splitByNumbering.length > 1) {
        tweets = splitByNumbering;
      }
    }

    if (tweets.length === 0 && (threadContent || "").length > 0) {
      tweets = [threadContent.trim()];
    }

    // Parse Booster
    let booster: any = null;
    if (boosterPart) {
      const lines = boosterPart.trim().split('\n');
      const hashtags = lines.find(l => l.includes('HASHTAG:'))?.split('HASHTAG:')[1]?.trim();
      const bestTime = lines.find(l => l.includes('WAKTU POSTING TERBAIK:'))?.split('WAKTU POSTING TERBAIK:')[1]?.trim();
      const hooks = lines.filter(l => l.match(/^\d\./)).map(l => l.replace(/^\d\.\s*/, '').trim());
      
      booster = {
        hashtags,
        bestTime,
        hooks
      };
    }

    // Add Score and Ghosting info to booster if they exist
    if (scorePart || ghostingPart) {
      if (!booster) booster = {};
      if (scorePart) booster.viralScore = scorePart.trim();
      if (ghostingPart) booster.antiGhosting = ghostingPart.trim();
    }

    const result = { tweets, booster };
    
    // Store in cache
    const cacheKey = `${topic.toLowerCase().trim()}_${tone}_${length}`;
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    res.json(result);
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: error.message || "Gagal generate thread." });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", environment: process.env.NODE_ENV });
});

// Server setup
async function startApp() {
  if (process.env.NODE_ENV !== "production") {
    // Dynamic import Vite only in development
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Dev server running on http://localhost:${PORT}`);
    });
  } else {
    // In production (Vercel), static files are handled by vercel.json
    // We just serve them as a fallback if needed
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    // Only listen if not on Vercel (e.g. local production test)
    if (!process.env.VERCEL) {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Prod server running on port ${PORT}`);
      });
    }
  }
}

startApp();

export default app;
