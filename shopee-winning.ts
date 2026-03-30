// ============================================================
// shopee-winning.ts — Tambahkan ke project server.ts kamu
// Ambil produk winning Shopee + jumlah terjual, harga, rating
// ============================================================

// ── Types ────────────────────────────────────────────────────
export interface ShopeeProduct {
  itemid: number;
  shopid: number;
  name: string;
  price: number;           // dalam rupiah (sudah dibagi 100000)
  priceFormatted: string;  // "Rp 50.000"
  sold: number;            // terjual bulan ini
  historicalSold: number;  // total terjual sepanjang waktu
  stock: number;
  rating: number;          // 0-5
  ratingCount: number;
  image: string;           // URL gambar
  shopeeUrl: string;       // link produk
  category: string;
  isOfficialShop: boolean;
}

// ── Kategori Shopee Indonesia (cat id) ───────────────────────
export const SHOPEE_CATEGORIES: Record<string, number> = {
  "Semua": 0,
  "Fashion Wanita": 11212788,
  "Fashion Pria": 11212791,
  "Elektronik": 11212800,
  "Handphone & Aksesoris": 11212798,
  "Kecantikan": 11212806,
  "Kesehatan": 11212807,
  "Rumah & Dapur": 11212808,
  "Makanan & Minuman": 11212792,
  "Olahraga": 11212810,
  "Mainan & Hobi": 11212811,
};

const SHOPEE_BASE = "https://shopee.co.id";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/122.0.0.0 Safari/537.36",
  "Referer": "https://shopee.co.id/",
  "X-Requested-With": "XMLHttpRequest",
};

// ── Format harga ─────────────────────────────────────────────
function formatPrice(rawPrice: number): string {
  const rp = Math.round(rawPrice / 100000);
  return "Rp " + rp.toLocaleString("id-ID");
}

// ── 1. Search produk by keyword, sort by sales ───────────────
export async function searchWinningProducts(
  keyword: string,
  limit = 20
): Promise<ShopeeProduct[]> {
  const url =
    `${SHOPEE_BASE}/api/v4/search/search_items?` +
    `keyword=${encodeURIComponent(keyword)}` +
    `&by=sales&order=desc` +
    `&limit=${limit}&newest=0` +
    `&page_type=search&scenario=PAGE_GLOBAL_SEARCH` +
    `&version=2`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Shopee search failed: ${res.status}`);

  const data = await res.json();
  const items = data?.items ?? [];

  return items.map((item: any) => mapToProduct(item.item_basic ?? item));
}

// ── 2. Produk terlaris per kategori ──────────────────────────
export async function getTopSellingByCategory(
  categoryId: number,
  limit = 20
): Promise<ShopeeProduct[]> {
  const url =
    `${SHOPEE_BASE}/api/v4/search/search_items?` +
    `match_id=${categoryId}` +
    `&by=sales&order=desc` +
    `&limit=${limit}&newest=0` +
    `&page_type=search`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Shopee category fetch failed: ${res.status}`);

  const data = await res.json();
  const items = data?.items ?? [];

  return items.map((item: any) => mapToProduct(item.item_basic ?? item));
}

// ── 3. Detail produk (harga + sold akurat) ───────────────────
export async function getProductDetail(
  shopId: number,
  itemId: number
): Promise<ShopeeProduct | null> {
  const url =
    `${SHOPEE_BASE}/api/v4/pdp/get_pc?` +
    `shop_id=${shopId}&item_id=${itemId}`;

  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;

    const data = await res.json();
    const item = data?.data?.item;
    if (!item) return null;

    return mapToProduct(item);
  } catch {
    return null;
  }
}

// ── 4. Flash sale — produk dengan diskon besar + laku ────────
export async function getFlashSaleWinners(): Promise<ShopeeProduct[]> {
  const url =
    `${SHOPEE_BASE}/api/v2/flash_sale/flash_sale_batch_get_items?` +
    `sort_soldout=true&limit=20&offset=0`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Flash sale fetch failed: ${res.status}`);

  const data = await res.json();
  const items = data?.data?.items ?? [];

  return items.map((item: any) => ({
    ...mapToProduct(item),
    // Flash sale punya data extra
    sold: item.flash_sale_sold ?? item.sold ?? 0,
    stock: item.flash_sale_stock ?? item.stock ?? 0,
  }));
}

// ── 5. Multi-keyword winning scan (untuk app kamu) ────────────
export async function scanWinningProducts(
  keywords: string[] = [
    "skincare viral", "baju wanita", "aksesoris hp",
    "peralatan dapur", "suplemen kesehatan"
  ]
): Promise<ShopeeProduct[]> {
  const results = await Promise.allSettled(
    keywords.map(kw => searchWinningProducts(kw, 10))
  );

  const allProducts: ShopeeProduct[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allProducts.push(...result.value);
    }
  }

  // Sort by sold descending, deduplicate by itemid
  const seen = new Set<number>();
  return allProducts
    .filter(p => {
      if (seen.has(p.itemid)) return false;
      seen.add(p.itemid);
      return true;
    })
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 30);
}

// ── Helper: map raw Shopee item → ShopeeProduct ───────────────
function mapToProduct(item: any): ShopeeProduct {
  const itemid = item.itemid ?? item.item_id ?? 0;
  const shopid = item.shopid ?? item.shop_id ?? 0;
  const rawPrice = item.price ?? item.price_min ?? 0;
  const nameSlug = (item.name ?? "produk")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 60);

  return {
    itemid,
    shopid,
    name: item.name ?? "Unknown",
    price: Math.round(rawPrice / 100000),
    priceFormatted: formatPrice(rawPrice),
    sold: item.sold ?? 0,
    historicalSold: item.historical_sold ?? item.sold ?? 0,
    stock: item.stock ?? 0,
    rating: item.item_rating?.rating_star
      ? parseFloat(item.item_rating.rating_star.toFixed(1))
      : item.rating_star ?? 0,
    ratingCount: item.item_rating?.rating_count?.[0] ?? item.cmt_count ?? 0,
    image: item.image
      ? `https://down-id.img.susercontent.com/file/${item.image}`
      : "",
    shopeeUrl: `https://shopee.co.id/${nameSlug}-i.${shopid}.${itemid}`,
    category: item.catid?.toString() ?? "",
    isOfficialShop: item.is_official_shop ?? false,
  };
}
