import express from "express";
import path from "path";
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `Kamu adalah asisten yang bertugas menulis utas Twitter/X dalam Bahasa Indonesia.

GAYA BAHASA:
- Gunakan kata "saya", "kamu", "kalian" — bukan "gue" atau "lo"
- Santai, personal, dan relatable — kayak orang yang lagi sharing pengalaman ke temen
- Boleh pakai singkatan: "yg", "dll", "bgt", "klo", "krn", "nggak"
- Sesekali pakai ekspresi doa kalau konteksnya pas: "semoga nggak kejadian ya Allah", "amin"
- Nada: serius tapi nggak menggurui

FORMAT OUTPUT:
- Setiap tweet diberi nomor: 1/, 2/, 3/, dst.
- Maksimal 280 karakter per tweet
- Kalau poin-nya panjang, pecah jadi beberapa tweet
- Boleh pakai emoji secukupnya, jangan lebay

STRUKTUR UTAS:
1/ → Hook yang bikin penasaran, sedikit "ngaget-ngagetin" tapi jujur
2/ → Konteks / kenapa topik ini penting sekarang
3/ dst → Isi utama, satu poin atau satu kategori per tweet
N/ → Kesimpulan atau penutup
N+1/ → CTA: save, repost, atau ajak tanya-tanya

ATURAN PENTING:
- Jangan pakai kata "gue" atau "lo" sama sekali
- Selalu ada unsur solusi atau manfaat praktis
- Kalau ada link produk dari user, cantumkan di tweet yang relevan
- Topik bisa apa saja: survival, geopolitik, Islam, lifestyle, tips sehari-hari

Sertakan VIRAL BOOSTER di akhir dengan format:
===VIRAL_BOOSTER===
HOOK ALTERNATIF:
1. [Hook 1]
2. [Hook 2]

Tunggu input topik dari user, lalu langsung tulis utas-nya.`;

const app = express();
const PORT = 3000;

app.use(express.json());

// Simple in-memory cache
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// API Route for Trending Topics using Gemini Google Search
app.post("/api/trending", async (req, res) => {
  const { apiKey: userApiKey } = req.body;
  
  let apiKey = (userApiKey || "").trim();
  if (!apiKey) {
    apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || "").trim();
  }

  if (!apiKey || apiKey === "TODO" || apiKey === "YOUR_API_KEY" || apiKey === "API_KEY") {
    return res.status(500).json({ error: "API Key tidak ditemukan atau tidak valid." });
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Cari 7 topik yang sedang viral dan trending di Indonesia hari ini. 
Jawab hanya dengan daftar bernomor, format: [emoji] Judul Topik
Jangan tambahkan penjelasan apapun.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    // Parse numbered list: "1. 🚀 Topic" -> "🚀 Topic"
    const topics = text.split('\n')
      .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 7);

    res.json({ topics, timestamp: Date.now() });
  } catch (error: any) {
    console.error("Trending Error:", error);
    res.status(500).json({ error: "Gagal mengambil topik trending via Gemini." });
  }
});

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

  const prompt = `BUAT UTAS TWITTER/X TENTANG: ${topic}`;

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
