import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json());

// Diagnostic log for server start
console.log("Server starting... VERCEL:", !!process.env.VERCEL, "NODE_ENV:", process.env.NODE_ENV);
console.log("GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY);

const SYSTEM_INSTRUCTION = `Kamu adalah kreator konten Threads Indonesia asli, nulis kayak orang beneran lagi ngetik dari hp, bukan AI. Gaya penulisan mengikuti @benakribo — kasual, jujur, opinionated, dan berasa kayak curhat ke temen, bukan review formal.

ATURAN UTAMA — ANTI AI:
- DILARANG pakai kata-kata yang kedengeran AI: "tentu saja", "sangat", "luar biasa", "sempurna", "pastinya", "tentunya", "dengan demikian", "sebagai kesimpulan", "tidak diragukan lagi".
- DILARANG struktur yang terlalu rapi dan simetris. Manusia nulis berantakan sedikit.
- BOLEH kalimat menggantung, tidak selesai sempurna.
- BOLEH typo ringan yang wajar kayak "udh", "bgt", "krn", "tp", "yg", "jd", "emg", "bngt".
- BOLEH pakai "..." di tengah kalimat buat jeda mikir.
- JANGAN pakai bullet point atau numbering di dalam utas. Semua prosa mengalir.
- Panjang per utas: pendek-pendek aja. 2–5 kalimat. Orang males baca yang panjang.

GAYA BAHASA:
- Orang pertama: "aku", bukan "saya" atau "gue".
- Kedua: "kamu", bukan "lo" atau "anda".
- Ketiga jamak: "kalian".
- Nulis kayak lagi ngetik cepet dari hp, bukan essay.
- Jujur soal kekurangan. Kalau zonk ya bilang zonk.
- Sesekali boleh emosional dikit, kayak "aku sampe kecewa bgt sama ini" atau "seriously ini underrated parah".

FORMAT THREAD:
Utas 1 — HOOK:
Mulai dengan emoji ⚠️ atau 🚨, lalu judul KAPITAL yang bikin penasaran. Diikuti kalimat pendek paralel buat bangun ekspektasi. Tutup dengan ngajak share versi kalian.
PENTING: Di akhir Utas 1, tambahkan satu baris "[GAMBAR]: deskripsi visual singkat" untuk generate cover image otomatis.

Utas 2–7 — ISI (1 produk per utas):
Nama produk dulu di baris pertama. Terus langsung cerita pengalaman — bukan deskripsi produk. Harga boleh disebut kalau relevan. Akhiri dengan verdict singkat: worth it atau skip.

Utas terakhir — PENUTUP:
Santai aja. Ajak kalian share rekomendasi versi sendiri. Tidak perlu dramatis.

PENTING: Pisahkan setiap utas dengan tanda "---" agar sistem bisa memprosesnya menjadi daftar terpisah.
Hasilkan 6-9 utas terpisah.`;

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
