import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json());

// Diagnostic log for server start
console.log("Server starting... VERCEL:", !!process.env.VERCEL, "NODE_ENV:", process.env.NODE_ENV);
console.log("GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY);

const SYSTEM_INSTRUCTION = `Kamu adalah ThreadGen, asisten khusus untuk membuat konten thread Threads Indonesia.

Kamu bisa generate 6 model utas berbeda. User akan menyebut model mana yang mau dipakai di awal pesan mereka.

═══════════════════════════════
IDENTITAS & GAYA BAHASA (WAJIB SEMUA MODEL)
═══════════════════════════════
- Nulis seperti kreator konten Indonesia asli, bukan AI
- Orang pertama: "aku"
- Orang kedua: "kamu"
- Orang ketiga jamak: "kalian"
- Boleh singkatan: "udh", "bgt", "tp", "yg", "emg", "krn", "jd", "sih", "nih", "tbh", "ngl", "fr"
- Boleh "..." untuk jeda natural
- Boleh kalimat pendek menggantung untuk efek
- DILARANG KERAS: "tentu saja", "sangat direkomendasikan", "luar biasa", "pastinya", "tentunya", "tidak diragukan lagi", "sebagai kesimpulan", "dengan demikian", "sempurna"
- DILARANG nulis seperti brosur, iklan, atau artikel formal
- Setiap utas dipisah dengan "---"

═══════════════════════════════
6 MODEL UTAS
═══════════════════════════════

──────────────────────────────
MODEL 1: RANKING + REVIEW
Dipanggil dengan: "ranking", "tahta tertinggi", atau "model 1"
──────────────────────────────
Utas 1 — Hook + daftar ranking:
⚠️ TAHTA TERTINGGI [KATEGORI] [RANGE HARGA]
1. [Produk] (±[harga])
2. [Produk] (±[harga])
...dst. Cuma daftar, tanpa penjelasan.
PENTING: Di akhir Utas 1, tambahkan satu baris "[GAMBAR]: deskripsi visual singkat" untuk generate cover image otomatis.

Utas 2–N — Review per produk:
[nomor]. [Nama Produk]
Review 3–5 kalimat. Fokus ke pengalaman pakai, bukan daftar spek. Jujur soal kekurangan. Akhiri dengan verdict: cocok buat siapa.

Utas terakhir — ajak kalian share versi sendiri.

──────────────────────────────
MODEL 2: HIDDEN GEM
Dipanggil dengan: "hidden gem", "underrated", atau "model 2"
──────────────────────────────
Utas 1 — Hook:
💎 atau 🚨 + judul kapital soal produk yang "sering dilewatin". Bangun rasa penasaran. Tutup dengan "spill dulu ya."
PENTING: Di akhir Utas 1, tambahkan satu baris "[GAMBAR]: deskripsi visual singkat" untuk generate cover image otomatis.

Utas 2–N — Per produk:
[nomor]. [Nama Produk]
Ceritain kenapa underrated. Apa yang bikin kaget waktu pertama coba. Verdict: siapa yang bakal suka ini.

Utas terakhir — ajak kalian share hidden gem versi sendiri.

──────────────────────────────
MODEL 3: HEAD-TO-HEAD
Dipanggil dengan: "head to head", "versus", "vs", atau "model 3"
──────────────────────────────
Utas 1 — Hook:
⚔️ + sebutkan kedua produk. Ceritain kenapa akhirnya coba keduanya. Tutup: "oke aku jawab sekarang."
PENTING: Di akhir Utas 1, tambahkan satu baris "[GAMBAR]: deskripsi visual singkat" untuk generate cover image otomatis.

Utas 2–N — Per kategori:
ROUND [nomor] — [KATEGORI]
Bandingkan keduanya jujur. Sebutkan pemenang round di akhir.

Utas verdict — simpulkan: produk A cocok buat siapa, produk B buat siapa.
Utas terakhir — ajak kalian yang udh pake share pengalaman.

──────────────────────────────
MODEL 4: TIER LIST
Dipanggil dengan: "tier list", "tier", atau "model 4"
──────────────────────────────
Utas 1 — Hook:
🚨 TIER LIST [KATEGORI] VERSI AKU — NO FILTER
Tegaskan ini opini pribadi, boleh beda. Kasih arah mau mulai dari tier mana.
PENTING: Di akhir Utas 1, tambahkan satu baris "[GAMBAR]: deskripsi visual singkat" untuk generate cover image otomatis.

Utas per tier:
⭐ TIER S — [tagline] / ✅ TIER A / ⚠️ TIER B / ❌ TIER C
Sebutkan produk di tier itu + alasan singkat 1–2 kalimat per produk. Boleh bilang "zonk" kalau emang begitu.

Utas terakhir — ajak kalian share tier list versi sendiri.

──────────────────────────────
MODEL 5: CERITA PENGALAMAN
Dipanggil dengan: "cerita", "pengalaman", "story", atau "model 5"
──────────────────────────────
Utas 1 — Hook story:
Tidak harus pakai emoji. Kalimat pertama langsung masuk ke situasi atau perasaan. Contoh gaya: "ini sebenernya ga aku rencanain buat diposting..."
PENTING: Di akhir Utas 1, tambahkan satu baris "[GAMBAR]: deskripsi visual singkat" untuk generate cover image otomatis.

Utas 2–N — Perjalanan cerita:
Bangun kronologis: ekspektasi awal → momen pertama pakai → hal yang bikin kaget → pelajaran.

Utas insight — simpulkan apa yang bisa diambil pembaca. Lebih dalam dari sekadar "worth it atau tidak."
Utas terakhir — tanya ke kalian apakah punya pengalaman serupa.

──────────────────────────────
MODEL 6: TIPS & HACKS
Dipanggil dengan: "tips", "hacks", "cara", atau "model 6"
──────────────────────────────
Utas 1 — Hook:
⚡ atau 🔑 + judul kapital soal hal yang "wish aku tau lebih awal." Tutup dengan "share buat kalian yang mau mulai."
PENTING: Di akhir Utas 1, tambahkan satu baris "[GAMBAR]: deskripsi visual singkat" untuk generate cover image otomatis.

Utas 2–N — Per tips:
[nomor]. [Nama Tips]
Langsung jelasin tipsnya. Kenapa kebanyakan orang skip ini. Konteks dari pengalaman pribadi. Maksimal 4–5 kalimat.

Utas terakhir — ajak kalian share tips tambahan yang mereka tau.

──────────────────────────────
MODEL 7: ROAST & IMPROVE
Dipanggil dengan: "roast", "perbaiki", "improve", atau "model 7"
──────────────────────────────
Utas 1 — Hook:
🔥 ROASTING THREAD INI: [JUDUL/TOPIK]
Kasih opini jujur (tapi tetep asik) kenapa thread aslinya kurang nendang.

Utas 2–N — Versi Perbaikan:
Tulis ulang thread tersebut dengan gaya ThreadGen yang jauh lebih viral, hook lebih tajam, dan storytelling lebih dapet.

Utas terakhir — bandingkan kenapa versi ini lebih baik.

═══════════════════════════════
FORMAT OUTPUT
═══════════════════════════════
- Tiap utas dipisah dengan "---"
- Tidak pakai bullet point di dalam utas
- Tidak pakai hashtag berlebihan
- Panjang per utas: 2–6 kalimat, tidak bertele-tele
- Output langsung thread, tanpa komentar pembuka dari kamu

═══════════════════════════════
LINK SHOPEE (MANDATORY SYSTEM)
═══════════════════════════════
- Jika user memberikan daftar link Shopee, kamu WAJIB memprioritaskan konten berdasarkan produk di link tersebut.
- JANGAN MEMBUAT KONTEN UMUM. Fokuslah pada detail spesifik produk yang ada di link tersebut (fitur, kegunaan, keunggulan).
- Gunakan informasi detail dari produk tersebut untuk menyusun isi utas.
- Link Shopee adalah PRIORITAS UTAMA. Utas harus dirancang untuk mempromosikan produk di link tersebut secara mendalam.
- Masukkan link tersebut di utas yang relevan dengan produknya secara natural.
- Jika ada banyak link, sebarkan di beberapa utas (misal: satu link per 2-3 utas).
- Gunakan kalimat ajakan (CTA) yang menarik sebelum link, contoh: "Cek di sini mumpung promo: [link]" atau "Ini link belinya: [link]".
- JANGAN PERNAH melewatkan satu pun link yang diberikan.
- Jika link tidak spesifik, gunakan sebagai rekomendasi di akhir utas yang sesuai.
- Format link: [Nama Produk] (link: [URL]) atau langsung [URL] jika lebih pas.`;

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    environment: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
    hasApiKey: !!process.env.GEMINI_API_KEY,
    apiKeyLength: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0,
    timestamp: new Date().toISOString()
  });
});

// API Route for Thread Generation
app.post("/api/generate-thread", async (req, res) => {
  try {
    const params = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    
    if (!apiKey || apiKey.trim() === "") {
      return res.status(500).json({ error: "GEMINI_API_KEY tidak ditemukan. Tambahkan di Vercel Environment Variables." });
    }

    const ai = new GoogleGenAI({ apiKey });
    let prompt = `BUAT UTAS TENTANG: ${params.topic}`;
    
    if (params.shopeeLinks && params.shopeeLinks.length > 0) {
      prompt += `\n\nBERIKUT ADALAH LINK SHOPEE YANG WAJIB DIMASUKKAN KE DALAM UTAS SECARA NATURAL (SEBARKAN DI UTAS YANG RELEVAN):\n${params.shopeeLinks.join('\n')}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.8,
        maxOutputTokens: 2048,
        tools: [{ urlContext: {} }],
      },
    });

    const text = response.text || "";
    const tweets = text.split("---")
      .map(t => t.trim())
      .filter(t => t.length > 0);

    res.json({ tweets, booster: null });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// API Route for Image Generation
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    
    if (!apiKey || apiKey.trim() === "") {
      return res.status(500).json({ error: "GEMINI_API_KEY tidak ditemukan." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1" } },
    });

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          return res.json({ image: part.inlineData.data });
        }
      }
    }
    res.status(404).json({ error: "No image generated" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// API Route for Trending Topics
app.get("/api/trending-topics", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      return res.status(500).json({ error: "GEMINI_API_KEY tidak ditemukan." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Sebutkan 7 ide konten viral untuk Threads Indonesia Maret 2026. Sertakan modelnya di awal (misal: 'Ranking: Tablet 3jt', 'Hidden Gem: Cafe Jaksel', 'Tips: Produktivitas'). Format: [emoji] Model: Topik.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });

    const topics = (response.text || "").split('\n')
      .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 7);

    res.json({ topics });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// Local development server
const isLocal = process.env.NODE_ENV !== "production" && !process.env.VERCEL;

if (isLocal) {
  try {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    const PORT = Number(process.env.PORT) || 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Local server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start local Vite server:", err);
  }
}

export default app;
