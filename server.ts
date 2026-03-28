import "dotenv/config";
import express from "express";
import path from "path";
import { generateThread } from "./src/services/gemini";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json());

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
    const result = await generateThread(params);
    res.json(result);
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
      console.error("Critical: GEMINI_API_KEY is missing in server.ts");
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
      console.error("Critical: GEMINI_API_KEY is missing in trending-topics route");
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
