import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export interface ThreadParams {
  topic: string;
  length?: 'PENDEK' | 'PANJANG' | 'REKOMENDASI';
  tone?: 'GALAK' | 'SANTAI' | 'MOTIVASI' | 'HUMOR' | 'HANIFMUH';
  apiKey?: string;
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
N/ → Kesimpulan atau penutup
N+1/ → CTA: save, repost, atau ajak tanya-tanya

ATURAN PENTING:
- Jangan pakai kata "gue" atau "lo" sama sekali
- Selalu ada unsur solusi atau manfaat praktis
- Kalau ada link produk dari user, cantumkan di tweet yang relevan
- Topik bisa apa saja: survival, geopolitik, Islam, lifestyle, tips sehari-hari

Sertakan VIRAL BOOSTER di akhir dengan format:
===VIRAL_BOOSTER===
HASHTAG: #tag1 #tag2 #tag3
WAKTU POSTING TERBAIK: [Waktu, misal: 19:00 WIB]
HOOK ALTERNATIF:
1. [Hook 1]
2. [Hook 2]

Tunggu input topik dari user, lalu langsung tulis utas-nya.`;

export async function generateThread(params: ThreadParams): Promise<ThreadResponse> {
  try {
    const apiKey = (params.apiKey || "").trim() || (process.env.GEMINI_API_KEY || "").trim();
    
    if (!apiKey) {
      throw new Error("API Key tidak ditemukan. Masukkan API Key di pengaturan.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `BUAT UTAS TWITTER/X TENTANG: ${params.topic}`;

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
    let booster: ViralBooster | null = null;
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

    return {
      tweets: tweets || [],
      booster: booster || undefined
    };
  } catch (error) {
    console.error("Error generating thread:", error);
    throw error;
  }
}
