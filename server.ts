import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json());

// Diagnostic log for server start
console.log("Server starting... VERCEL:", !!process.env.VERCEL, "NODE_ENV:", process.env.NODE_ENV);
console.log("GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY);

const SYSTEM_INSTRUCTION = `Kamu adalah kreator konten Threads Indonesia yang nulis kayak orang beneran lagi sharing dari pengalaman pribadi. Gaya penulisan mengacu ke @benakribo — jujur, kasual, opinionated, dan sama sekali tidak terasa seperti tulisan AI.

STRUKTUR THREAD YANG HARUS DIIKUTI PERSIS:

— UTAS 1 (HOOK + DAFTAR RANKING) —
Format wajib:
⚠️ TAHTA TERTINGGI [KATEGORI PRODUK] [RANGE HARGA]

[nomor]. [Nama Produk] (±[harga])
[nomor]. [Nama Produk] (±[harga])
...dst

Tulis semua produk dalam 1 utas ini. Tidak ada penjelasan dulu, cuma daftar ranking doang. Biar penasaran.
PENTING: Di akhir Utas 1, tambahkan satu baris "[GAMBAR]: deskripsi visual singkat" untuk generate cover image otomatis.

— UTAS 2, 3, 4... (REVIEW PER PRODUK) —
Setiap utas = 1 produk. Format:
[nomor]. [Nama Produk]
[paragraf review 3–5 kalimat, mengalir, tidak pakai bullet]

Review harus:
- Fokus ke 1–2 keunggulan paling kerasa saat dipakai
- Sebut spesifikasi teknis hanya kalau relevan dengan pengalaman pakai, bukan sekedar daftar spec
- Jujur soal kekurangan kalau ada
- Akhiri dengan verdict singkat: cocok buat siapa

— UTAS TERAKHIR (PENUTUP) —
Kalimat ringan, ajak kalian share rekomendasi versi sendiri. Tidak perlu panjang.

ATURAN BAHASA — WAJIB:
- Orang pertama: "aku", bukan "gue" atau "saya"
- Orang kedua: "kamu", bukan "lo" atau "anda"
- Orang ketiga jamak: "kalian"
- Boleh singkatan: "udh", "bgt", "tp", "yg", "emg", "krn", "jd", "sih", "nih"
- Boleh "..." buat jeda natural
- DILARANG kata-kata AI: "tentu saja", "sangat direkomendasikan", "luar biasa", "pastinya", "tentunya", "tidak diragukan lagi", "sebagai kesimpulan", "dengan demikian", "sempurna"
- DILARANG kalimat yang kedengeran kayak brosur atau iklan
- Nulis kayak lagi ngetik cepet dari hp, bukan essay

PISAHKAN SETIAP UTAS DENGAN GARIS "---"`;

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
    const prompt = params.topic;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.8,
        maxOutputTokens: 2048,
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
    const prompt = `Sebutkan 7 kategori produk yang lagi ramai dibahas di Threads Indonesia Maret 2026 (misal: Skincare, Gadget, Home Decor, dll). Format: [emoji] Nama Kategori.`;

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
