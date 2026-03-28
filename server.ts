import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

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
2/ → REKOMENDASI PRODUK: Setelah tweet pertama, WAJIB tambahkan satu tweet rekomendasi produk yang relevan dengan topik. 
    Format: "Btw, buat yang nyari [produk terkait], ini ada yang bagus di Shopee: [link Shopee]". 
    Gunakan link Shopee asli jika tahu, atau gunakan placeholder "https://shope.ee/rekomendasi-produk" jika tidak tahu link spesifiknya.
3/ → Konteks / kenapa topik ini penting sekarang
4/ dst → Isi utama, satu poin atau satu kategori per tweet
5/ → Kesimpulan atau penutup
6/ → CTA: save, repost, atau ajak tanya-tanya

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
    hasApiKey: !!process.env.GEMINI_API_KEY,
    apiKeyLength: process.env.GEMINI_API_KEY?.length || 0
  });
});

// API Route for Thread Generation
app.post("/api/generate-thread", async (req, res) => {
  try {
    const params = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey.trim() === "") {
      return res.status(500).json({ error: "GEMINI_API_KEY tidak ditemukan di server. Pastikan Anda sudah menambahkan 'GEMINI_API_KEY' di Environment Variables Vercel dan melakukan redeploy." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `BUAT UTAS TWITTER/X TENTANG: ${params.topic}`;

    const response = await ai.models.generateContent({
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
    
    let tweets = (mainContent || "").split("\n").filter(line => line.match(/^\d+\//)).map(t => t.trim());
    
    if (tweets.length === 0) {
      tweets = (mainContent || "").split("\n\n").filter(t => t.trim().length > 0);
    }

    // Parse Booster
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
    console.error("Server Error (Thread):", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// API Route for Image Generation
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey.trim() === "") {
      return res.status(500).json({ error: "GEMINI_API_KEY tidak ditemukan di server. Pastikan Anda sudah menambahkan 'GEMINI_API_KEY' di Environment Variables Vercel dan melakukan redeploy." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
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
    console.error("Server Error (Image):", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// API Route for Trending Topics
app.get("/api/trending-topics", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      return res.status(500).json({ error: "GEMINI_API_KEY tidak ditemukan di server. Pastikan Anda sudah menambahkan 'GEMINI_API_KEY' di Environment Variables Vercel dan melakukan redeploy." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Kamu adalah AI yang tahu berita terkini Indonesia. 
Sebutkan 7 topik yang kemungkinan sedang trending di Indonesia bulan Maret 2026. 
Format jawaban HANYA daftar bernomor:
[emoji] Judul Topik
Tanpa penjelasan tambahan apapun.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });

    const text = response.text || "";
    const topics = text.split('\n')
      .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 7);

    res.json({ topics });
  } catch (error: any) {
    console.error("Server Error (Trending):", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Only listen if not on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
