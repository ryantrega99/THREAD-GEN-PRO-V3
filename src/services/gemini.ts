import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

export interface ThreadParams {
  topic: string;
  length?: 'PENDEK' | 'PANJANG' | 'REKOMENDASI';
  tone?: 'GALAK' | 'SANTAI' | 'MOTIVASI' | 'HUMOR' | 'HANIFMUH';
}

export interface ViralBooster {
  hashtags?: string;
  bestTime?: string;
  hooks?: string[];
  viralScore?: string;
  antiGhosting?: string;
}

export interface ThreadResponse {
  tweets: string[];
  booster?: ViralBooster;
}

export interface TrendingProduct {
  name: string;
  category: string;
  reason: string;
  priceRange?: string;
  source: "gemini" | "shopee";
}

const SYSTEM_INSTRUCTION = `Kamu adalah ThreadGen, asisten khusus untuk membuat konten thread Threads Indonesia.

GAYA BAHASA UMUM:
- Nulis seperti kreator konten Indonesia asli, bukan AI.
- Orang pertama: "aku", Orang kedua: "kamu", Orang ketiga jamak: "kalian".
- Boleh singkatan: "udh", "bgt", "tp", "yg", "emg", "krn", "jd", "sih", "nih", "tbh", "ngl", "fr".
- Santai, personal, dan relatable — kayak orang yang lagi sharing pengalaman ke temen.
- DILARANG KERAS: "tentu saja", "sangat direkomendasikan", "luar biasa", "pastinya", "tentunya", "tidak diragukan lagi", "sebagai kesimpulan", "dengan demikian", "sempurna".

DEFINISI TONE:
- GALAK: To the point, tegas, agak ngegas tapi tetep edukatif.
- SANTAI: Kayak ngobrol biasa, banyak slang, chill.
- MOTIVASI: Inspiratif, pake kata-kata penyemangat tapi tetep humble.
- HUMOR: Banyak bercanda, receh, pake analogi lucu.
- HANIFMUH: Gaya khas Hanif Muhammad. Sangat teknis tapi dijelasin pake bahasa awam, jujur (blak-blakan), fokus ke value for money, dan sering pake istilah "Tahta Tertinggi".

FORMAT OUTPUT:
- Setiap tweet diberi nomor: 1/, 2/, 3/, dst.
- Maksimal 280 karakter per tweet
- Tiap tweet dipisah dengan "---"
- Output langsung thread, tanpa komentar pembuka dari kamu

STRUKTUR UTAS (RANKING/REKOMENDASI):
Wajib gunakan pola ini jika topik adalah tentang ranking produk:
1/ → Hook + Daftar Ringkasan (Summary List). 
   Contoh: 
   TAHTA TERTINGGI [TOPIK] SESUAI KEUNGGULANNYA
   1. [Kategori] : [Brand] ([Harga])
   2. [Kategori] : [Brand] ([Harga])
   ...
2/ dst → Penjelasan detail per item.
   Contoh:
   1. [Brand]
   [Penjelasan singkat kenapa dia masuk ranking, pake bahasa sesuai TONE yang diminta]
N/ → Kesimpulan atau penutup.
N+1/ → CTA (Call to Action).

STRUKTUR UTAS (UMUM):
1/ → Hook yang bikin penasaran
2/ → Isi utama (sharing/tips/cerita)
N/ → Kesimpulan atau penutup
N+1/ → CTA

KEBIJAKAN PRODUK:
- Gunakan Google Search untuk mencari informasi terbaru tentang produk, spesifikasi, dan harga.
- Hanya cantumkan produk yang saat ini tersedia di Shopee Indonesia.
- DILARANG mencantumkan produk yang sudah discontinue (tidak diproduksi lagi) atau sangat sulit dicari.
- Pastikan harga yang dicantumkan adalah estimasi harga terbaru di marketplace.

Sertakan VIRAL BOOSTER di akhir dengan format:
===VIRAL_BOOSTER===
HASHTAG: #tag1 #tag2 #tag3
WAKTU POSTING TERBAIK: [Waktu]
HOOK ALTERNATIF:
1. [Hook 1]
2. [Hook 2]
`;

function getApiKey(): string {
  // Check multiple possible locations for the API key
  const key = 
    process.env.GEMINI_API_KEY || 
    process.env.API_KEY || 
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    (import.meta as any).env?.GEMINI_API_KEY;

  if (!key || key === "undefined" || key === "null") {
    console.error("Gemini API Key missing. Checked process.env.GEMINI_API_KEY, process.env.API_KEY, and import.meta.env.");
    throw new Error("Gemini API Key tidak ditemukan. Pastikan Anda sudah memasukkan GEMINI_API_KEY di Settings (AI Studio) atau Environment Variables (Vercel).");
  }
  
  // Debug log (obfuscated)
  console.log(`Gemini API Key found, length: ${key.length}, starts with: ${key.substring(0, 4)}...`);
  return key;
}

export async function generateThread(params: ThreadParams): Promise<ThreadResponse> {
  try {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    
    const isRanking = params.topic.toLowerCase().startsWith('ranking:');
    const cleanTopic = isRanking ? params.topic.replace(/^ranking:\s*/i, '') : params.topic;

    const prompt = `
BUAT UTAS TWITTER/X TENTANG: ${cleanTopic}
TONE: ${params.tone || 'SANTAI'}
PANJANG UTAS: ${params.length || 'PENDEK'} (Jika PENDEK: 3-5 tweet, jika PANJANG: 7-10 tweet, jika REKOMENDASI: sesuaikan jumlah item)

${isRanking ? `
KHUSUS UNTUK FORMAT RANKING:
Tweet 1 WAJIB menggunakan format persis seperti ini:
TAHTA TERTINGGI ${cleanTopic.toUpperCase()} SESUAI KEUNGGULANNYA
1. [Keunggulan/Kategori] : [Nama Produk/Brand] ([Estimasi Harga])
2. [Keunggulan/Kategori] : [Nama Produk/Brand] ([Estimasi Harga])
... (lanjutkan sampai minimal 5-6 item)

Tweet 2 dan seterusnya:
Berikan penjelasan singkat dan padat untuk masing-masing item di atas dengan gaya bahasa ${params.tone || 'SANTAI'}.

PENTING:
- Hanya pilih produk yang masih dijual di Shopee dan BUKAN barang discontinue.
` : `
Instruksi Tambahan:
- Pastikan bahasa sangat ${params.tone || 'SANTAI'} dan relatable.
- Hanya pilih produk yang masih dijual di Shopee dan BUKAN barang discontinue.
`}
`.trim();

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.8,
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    const [mainContent, boosterPart] = text.split("===VIRAL_BOOSTER===");
    
    let tweets = (mainContent || "").split("---").map(t => t.trim()).filter(t => t.length > 0);
    
    if (tweets.length <= 1) {
      const numberingRegex = /\n(?=\d+\/)/g;
      const splitByNumbering = (mainContent || "").split(numberingRegex).map(t => t.trim()).filter(t => t.length > 0);
      if (splitByNumbering.length > 1) tweets = splitByNumbering;
    }

    let booster: ViralBooster | undefined;
    if (boosterPart) {
      const lines = boosterPart.trim().split('\n');
      booster = {
        hashtags: lines.find(l => l.includes('HASHTAG:'))?.split('HASHTAG:')[1]?.trim(),
        bestTime: lines.find(l => l.includes('WAKTU POSTING TERBAIK:'))?.split('WAKTU POSTING TERBAIK:')[1]?.trim(),
        hooks: lines.filter(l => l.match(/^\d\./)).map(l => l.replace(/^\d\.\s*/, '').trim())
      };
    }

    return { tweets, booster };
  } catch (error) {
    console.error("Error generating thread:", error);
    throw error;
  }
}

export async function fetchTrendingTopics(): Promise<string[]> {
  try {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Sebutkan 7 ide konten viral untuk Threads Indonesia saat ini. Sertakan modelnya di awal (misal: 'Ranking: Tablet 3jt', 'Hidden Gem: Cafe Jaksel', 'Tips: Produktivitas'). Format: [emoji] Model: Topik.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });

    return (response.text || "").split('\n')
      .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 7);
  } catch (error) {
    console.error("Error fetching trending topics:", error);
    return [];
  }
}

export async function fetchTrendingViaGemini(): Promise<TrendingProduct[]> {
  try {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

    const prompt = `
Hari ini ${today}. Cari produk yang sedang paling viral dan trending di Shopee Indonesia saat ini.
Berikan TEPAT 6 produk dalam format JSON array berikut, tanpa teks lain:
[
  {
    "name": "nama produk spesifik",
    "category": "kategori",
    "reason": "alasan singkat kenapa trending",
    "priceRange": "estimasi range harga"
  }
]
    `.trim();

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      },
    });

    const text = response.text || "[]";
    const parsed = JSON.parse(text);
    return parsed.map((p: any) => ({ ...p, source: "gemini" as const }));
  } catch (error) {
    console.error("Error fetching trending products via Gemini:", error);
    return [];
  }
}

export async function generateCoverImage(prompt: string): Promise<string> {
  try {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `A vibrant, high-quality social media cover image for: ${prompt}. Modern aesthetic, no text.` }] },
      config: { imageConfig: { aspectRatio: "1:1" } },
    });

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) return part.inlineData.data;
      }
    }
    throw new Error("Gagal generate gambar.");
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
}
