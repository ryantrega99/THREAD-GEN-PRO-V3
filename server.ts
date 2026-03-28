import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json());

// Diagnostic log for server start
console.log("Server starting... VERCEL:", !!process.env.VERCEL, "NODE_ENV:", process.env.NODE_ENV);
console.log("GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY);

const SYSTEM_INSTRUCTION = `Kamu adalah asisten yang bertugas menulis utas Twitter/X dalam Bahasa Indonesia.

GAYA BAHASA:
- Gunakan kata "saya", "kamu", "kalian" — bukan "gue" atau "lo"
- Santai, personal, dan relatable — kayak orang yang lagi sharing pengalaman ke temen
- Boleh pakai singkatan: "yg", "dll", "bgt", "klo", "krn", "nggak"
- Sesekali pakai ekspresi doa kalau konteksnya pas: "semoga nggak kejadian ya Allah", "amin"
- Nada: serius tapi nggak menggurui

FORMAT OUTPUT:
- Gunakan pemisah "---" (tiga strip) di antara setiap tweet untuk memberikan jeda.
- Setiap tweet dimulai dengan nomor: 1/, 2/, 3/, dst.
- SETIAP TWEET (mulai dari tweet pertama sampai terakhir) WAJIB menyertakan satu link rekomendasi produk Shopee yang relevan di bagian akhir tweet tersebut.
- Format link: "Btw, cek [produk terkait] di Shopee: [link Shopee]".
- Gunakan placeholder "https://shope.ee/rekomendasi-produk" jika tidak tahu link spesifiknya.
- Maksimal 280 karakter per tweet (termasuk link).

STRUKTUR UTAS:
1/ [Hook] + [Link Shopee]
---
2/ [Isi/Konteks] + [Link Shopee]
---
3/ [Poin Utama] + [Link Shopee]
... dst.

Sertakan VIRAL BOOSTER di akhir dengan format:
===VIRAL_BOOSTER===
HASHTAG: #tag1 #tag2 #tag3
WAKTU POSTING TERBAIK: [Waktu, misal: 19:00 WIB]
HOOK ALTERNATIF:
1. [Hook 1]
2. [Hook 2]`;

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
    const prompt = `BUAT UTAS TWITTER/X TENTANG: ${params.topic}`;

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
    const [mainContent, boosterPart] = text.split("===VIRAL_BOOSTER===");
    
    // Split by separator "---" first
    let tweets = (mainContent || "").split("---").map(t => t.trim()).filter(t => t.length > 0);
    
    // Fallback if separator is not used
    if (tweets.length <= 1) {
      tweets = (mainContent || "").split("\n").filter(line => line.match(/^\d+\//)).map(t => t.trim());
      if (tweets.length === 0) {
        tweets = (mainContent || "").split("\n\n").filter(t => t.trim().length > 0);
      }
    }

    let booster: any = null;
    if (boosterPart) {
      const lines = boosterPart.trim().split('\n');
      const hashtags = lines.find(l => l.includes('HASHTAG:'))?.split('HASHTAG:')[1]?.trim();
      const bestTime = lines.find(l => l.includes('WAKTU POSTING TERBAIK:'))?.split('WAKTU POSTING TERBAIK:')[1]?.trim();
      const hooks = lines.filter(l => l.match(/^\d\./)).map(l => l.replace(/^\d\.\s*/, '').trim());
      booster = { hashtags, bestTime, hooks };
    }

    res.json({ tweets, booster });
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
    const prompt = `Sebutkan 7 topik trending di Indonesia Maret 2026. Format: [emoji] Judul Topik.`;

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
