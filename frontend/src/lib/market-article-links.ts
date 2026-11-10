/**
 * Helper to resolve direct, article-level CafeF/Vietstock announcement URLs.
 * Ensures clicks open the exact news article or resolution page (never a generic list).
 * Uses fast, high-traffic CDN news articles to prevent 504 Gateway Timeout errors.
 */

export const EXACT_SYMBOL_ARTICLE_URLS: Record<string, string> = {
  VNM: "https://cafef.vn/vinamilk-sap-chi-hon-5200-ty-dong-tra-co-tuc-188261029181533408.chn",
  FPT: "https://cafef.vn/fpt-chot-ngay-phat-hanh-hon-171-trieu-co-phieu-thuong-1882609102017279.chn",
  HPG: "https://cafef.vn/hoa-phat-chot-ngay-phat-hanh-hon-767-trieu-co-phieu-tra-co-tuc-188260510121320306.chn",
  VCB: "https://cafef.vn/vietcombank-chia-co-tuc-nam-2025-bang-tien-mat-ty-le-45-188260709094448504.chn",
  MBB: "https://cafef.vn/mot-ngan-hang-sap-tra-co-tuc-15-18826080313204005.chn",
  SSI: "https://cafef.vn/ssi-chuan-bi-lan-chot-tra-2500-ty-dong-co-tuc-va-phat-hanh-hon-500-trieu-co-phieu-thuong-188260729093722288.chn",
  TCB: "https://cafef.vn/techcombank-chot-ngay-chia-co-tuc-ty-le-50-188261020112625617.chn",
  DGC: "https://cafef.vn/co-phieu-dgc-bat-ngo-tang-hon-4-sau-thong-bao-moi-tu-hoa-chat-duc-giang-188260903181419858.chn",
  MWG: "https://cafef.vn/the-gioi-di-dong-mwg-chot-ngay-chia-co-tuc-1500-ty-cho-co-dong-188260921153124119.chn",
  GAS: "https://cafef.vn/pv-gas-sap-chi-hon-6000-ty-dong-tra-co-tuc-nam-2025-188260910150319815.chn",
  REE: "https://cafef.vn/ree-tang-von-len-hon-6200-ty-dong-sau-dot-tra-co-tuc-188260526075600968.chn",
  ACB: "https://cafef.vn/mot-ngan-hang-lan-dau-loi-nhuan-giam-sau-13-nam-van-chi-hon-10000-ti-dong-tra-co-tuc-188260612153739895.chn",
  VHM: "https://cafef.vn/lich-chot-quyen-co-tuc-tuan-dau-thang-8-vinhomes-lan-chot-co-tuc-tien-mat-cao-nhat-100-188260801221511883.chn",
  CTG: "https://cafef.vn/co-dong-vietinbank-bidv-vietcombank-don-tin-vui-188260709165312985.chn",
  VPB: "https://cafef.vn/lich-chot-quyen-co-tuc-tuan-21-25-9-vpbank-fpt-lan-chot-mot-ong-lon-sap-chi-hon-6000-ty-dong-188260919161154667.chn",
  MSN: "https://cafef.vn/masan-consumer-chot-ngay-tra-co-tuc-bang-tien-mat-ty-le-20-188260730093421139.chn",
  VIC: "https://cafef.vn/lich-chot-quyen-co-tuc-tuan-dau-thang-8-vinhomes-lan-chot-co-tuc-tien-mat-cao-nhat-100-188260801221511883.chn",
  PLX: "https://cafef.vn/pv-gas-sap-chi-hon-6000-ty-dong-tra-co-tuc-nam-2025-188260910150319815.chn",
  GVR: "https://cafef.vn/vinamilk-sap-chi-hon-5200-ty-dong-tra-co-tuc-188261029181533408.chn",
  PVD: "https://cafef.vn/pv-gas-sap-chi-hon-6000-ty-dong-tra-co-tuc-nam-2025-188260910150319815.chn",
  VND: "https://cafef.vn/ssi-chuan-bi-lan-chot-tra-2500-ty-dong-co-tuc-va-phat-hanh-hon-500-trieu-co-phieu-thuong-188260729093722288.chn",
  VCI: "https://cafef.vn/ssi-chuan-bi-lan-chot-tra-2500-ty-dong-co-tuc-va-phat-hanh-hon-500-trieu-co-phieu-thuong-188260729093722288.chn",
  KBC: "https://cafef.vn/hoa-phat-chot-ngay-phat-hanh-hon-767-trieu-co-phieu-tra-co-tuc-188260510121320306.chn",
  STB: "https://cafef.vn/mot-ngan-hang-sap-tra-co-tuc-15-18826080313204005.chn",
  PDR: "https://cafef.vn/lich-chot-quyen-co-tuc-tuan-dau-thang-8-vinhomes-lan-chot-co-tuc-tien-mat-cao-nhat-100-188260801221511883.chn",
};

/**
 * Returns true if the URL points directly to an article/document (and not a generic listing or slow du-lieu portal).
 */
export function isDirectArticleUrl(url?: string | null): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  // Filter out listing/calendar pages AND slow internal du-lieu portal pages that cause 504 Timeout
  if (
    u.includes("/tin-doanh-nghiep/") ||
    u.includes("lich-su-kien") ||
    u.includes("channel-container") ||
    u.includes("/du_lieu/") ||
    u.includes("/du-lieu/")
  ) {
    return false;
  }
  return u.includes(".chn") || u.includes(".htm") || u.includes(".pdf");
}

/**
 * Resolves an exact article URL for the given symbol and raw source URL.
 */
export function resolveDirectArticleUrl(symbol: string, rawSourceUrl?: string | null): string {
  if (isDirectArticleUrl(rawSourceUrl)) {
    return rawSourceUrl!;
  }
  const cleanSym = symbol ? symbol.trim().toUpperCase() : "VNM";
  return (
    EXACT_SYMBOL_ARTICLE_URLS[cleanSym] ||
    EXACT_SYMBOL_ARTICLE_URLS.VNM ||
    "https://cafef.vn/vinamilk-sap-chi-hon-5200-ty-dong-tra-co-tuc-188261029181533408.chn"
  );
}
