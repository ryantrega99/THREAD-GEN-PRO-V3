import "dotenv/config";
import express from "express";
import path from "path";
import {
  searchWinningProducts,
  getTopSellingByCategory,
  getFlashSaleWinners,
  scanWinningProducts,
  SHOPEE_CATEGORIES,
} from "./shopee-winning";

const app = express();
app.use(express.json());

// Diagnostic log for server start
console.log("Server starting... VERCEL:", !!process.env.VERCEL, "NODE_ENV:", process.env.NODE_ENV);

// ── Shopee Scraper Engine (Backend to avoid CORS) ─────────────
// Using a search-based approach which is more stable than internal recommendation APIs
async function fetchTrendingViaShopee(): Promise<any[]> {
  try {
    const url = "https://shopee.co.id/api/v4/search/search_items?by=relevancy&limit=12&newest=0&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2&keyword=viral";
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://shopee.co.id/search?keyword=viral",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (!res.ok) {
      throw new Error(`Shopee API status: ${res.status}`);
    }

    const data = await res.json();
    const items = data?.items ?? [];

    return items.slice(0, 8).map((item: any) => ({
      name: item.item_basic.name,
      category: "Viral",
      reason: `${(item.item_basic.historical_sold / 1000).toFixed(1)}rb+ terjual`,
      priceRange: `Rp ${Math.round(item.item_basic.price / 100000).toLocaleString("id-ID")}.000`,
      source: "shopee",
    }));
  } catch (err: any) {
    console.error("[Shopee Scraper] Error:", err.message);
    return [];
  }
}

// API Route for Shopee Trending
app.get("/api/trending-shopee", async (req, res) => {
  try {
    const products = await fetchTrendingViaShopee();
    res.json({ success: true, data: products });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Cache for Shopee Winning ─────────────────────────────────
const shopeeCache = new Map<string, { data: any; ts: number }>();
const SHOPEE_TTL = 60 * 60 * 1000; // 1 jam

function cachedShopee(key: string, fn: () => Promise<any>) {
  return async () => {
    const hit = shopeeCache.get(key);
    if (hit && Date.now() - hit.ts < SHOPEE_TTL) return hit.data;
    const data = await fn();
    shopeeCache.set(key, { data, ts: Date.now() });
    return data;
  };
}

// ── Endpoint 1: Produk winning by keyword ────────────────────
app.get("/api/shopee/winning", async (req, res) => {
  try {
    const keyword = (req.query.keyword as string) || "trending";
    const limit = parseInt(req.query.limit as string) || 20;
    const cacheKey = `winning:${keyword}:${limit}`;

    const products = await cachedShopee(cacheKey, () =>
      searchWinningProducts(keyword, limit)
    )();

    res.json({ success: true, keyword, count: products.length, data: products });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Endpoint 2: Top selling by kategori ──────────────────────
app.get("/api/shopee/category", async (req, res) => {
  try {
    const name = (req.query.name as string) || "Semua";
    const catId = SHOPEE_CATEGORIES[name] ?? 0;
    const limit = parseInt(req.query.limit as string) || 20;

    const products = await cachedShopee(`cat:${catId}`, () =>
      getTopSellingByCategory(catId, limit)
    )();

    res.json({ success: true, category: name, data: products });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Endpoint 3: Flash sale winners ───────────────────────────
app.get("/api/shopee/flash", async (req, res) => {
  try {
    const products = await cachedShopee("flash", getFlashSaleWinners)();
    res.json({ success: true, data: products });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Endpoint 4: Auto-scan multi-keyword (untuk "Trending Now") 
app.get("/api/shopee/trending", async (req, res) => {
  try {
    const products = await cachedShopee("trending", () =>
      scanWinningProducts()
    )();
    res.json({ success: true, count: products.length, data: products });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString()
  });
});

// Local development server & SPA fallback
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
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

export default app;
