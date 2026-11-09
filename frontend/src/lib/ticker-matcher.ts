export type StockDirectoryItem = {
  symbol: string;
  name: string;
  sector: string;
  exchange: "HOSE" | "HNX" | "UPCoM";
  tier: "vn30" | "major" | "standard";
};

export const STOCK_DIRECTORY: readonly StockDirectoryItem[] = [
  { symbol: "HPG", name: "Tập đoàn Hòa Phát", sector: "Tài nguyên Cơ bản", exchange: "HOSE", tier: "vn30" },
  { symbol: "VIC", name: "Tập đoàn Vingroup", sector: "Bất động sản", exchange: "HOSE", tier: "vn30" },
  { symbol: "VHM", name: "CTCP Vinhomes", sector: "Bất động sản", exchange: "HOSE", tier: "vn30" },
  { symbol: "VRE", name: "CTCP Vincom Retail", sector: "Bất động sản", exchange: "HOSE", tier: "vn30" },
  { symbol: "VCB", name: "Ngân hàng Vietcombank", sector: "Ngân hàng", exchange: "HOSE", tier: "vn30" },
  { symbol: "TCB", name: "Ngân hàng Techcombank", sector: "Ngân hàng", exchange: "HOSE", tier: "vn30" },
  { symbol: "MBB", name: "Ngân hàng Quân Đội (MB Bank)", sector: "Ngân hàng", exchange: "HOSE", tier: "vn30" },
  { symbol: "VPB", name: "Ngân hàng VPBank", sector: "Ngân hàng", exchange: "HOSE", tier: "vn30" },
  { symbol: "ACB", name: "Ngân hàng ACB", sector: "Ngân hàng", exchange: "HOSE", tier: "vn30" },
  { symbol: "STB", name: "Ngân hàng Sacombank", sector: "Ngân hàng", exchange: "HOSE", tier: "vn30" },
  { symbol: "HDB", name: "Ngân hàng HDBank", sector: "Ngân hàng", exchange: "HOSE", tier: "vn30" },
  { symbol: "TPB", name: "Ngân hàng TPBank", sector: "Ngân hàng", exchange: "HOSE", tier: "vn30" },
  { symbol: "BID", name: "Ngân hàng BIDV", sector: "Ngân hàng", exchange: "HOSE", tier: "vn30" },
  { symbol: "CTG", name: "Ngân hàng VietinBank", sector: "Ngân hàng", exchange: "HOSE", tier: "vn30" },
  { symbol: "SHB", name: "Ngân hàng SHB", sector: "Ngân hàng", exchange: "HOSE", tier: "vn30" },
  { symbol: "SSB", name: "Ngân hàng SeABank", sector: "Ngân hàng", exchange: "HOSE", tier: "vn30" },
  { symbol: "VIB", name: "Ngân hàng VIB", sector: "Ngân hàng", exchange: "HOSE", tier: "vn30" },
  { symbol: "FPT", name: "Tập đoàn FPT", sector: "Công nghệ Thông tin", exchange: "HOSE", tier: "vn30" },
  { symbol: "SSI", name: "CTCP Chứng khoán SSI", sector: "Dịch vụ tài chính", exchange: "HOSE", tier: "vn30" },
  { symbol: "VNM", name: "CTCP Sữa Việt Nam (Vinamilk)", sector: "Thực phẩm và đồ uống", exchange: "HOSE", tier: "vn30" },
  { symbol: "MSN", name: "Tập đoàn Masan", sector: "Thực phẩm và đồ uống", exchange: "HOSE", tier: "vn30" },
  { symbol: "MWG", name: "CTCP Đầu tư Thế Giới Di Động", sector: "Bán lẻ", exchange: "HOSE", tier: "vn30" },
  { symbol: "SAB", name: "Tổng CTCP Bia - Rượu - NGK Sài Gòn (Sabeco)", sector: "Thực phẩm và đồ uống", exchange: "HOSE", tier: "vn30" },
  { symbol: "GAS", name: "Tổng Công ty Khí Việt Nam (PV Gas)", sector: "Dầu khí", exchange: "HOSE", tier: "vn30" },
  { symbol: "PLX", name: "Tập đoàn Xăng dầu Việt Nam (Petrolimex)", sector: "Dầu khí", exchange: "HOSE", tier: "vn30" },
  { symbol: "POW", name: "Tổng Công ty Điện lực Dầu khí Việt Nam (PV Power)", sector: "Tiện ích", exchange: "HOSE", tier: "vn30" },
  { symbol: "GVR", name: "Tập đoàn Công nghiệp Cao su Việt Nam", sector: "Hóa chất", exchange: "HOSE", tier: "vn30" },
  { symbol: "BCM", name: "Tổng Công ty Đầu tư và Phát triển Công nghiệp (Becamex)", sector: "Bất động sản", exchange: "HOSE", tier: "vn30" },
  { symbol: "VJC", name: "CTCP Hàng không Vietjet", sector: "Du lịch và Giải trí", exchange: "HOSE", tier: "vn30" },
  { symbol: "BVH", name: "Tập đoàn Bảo Việt", sector: "Bảo hiểm", exchange: "HOSE", tier: "vn30" },
  { symbol: "VND", name: "CTCP Chứng khoán VNDIRECT", sector: "Dịch vụ tài chính", exchange: "HOSE", tier: "major" },
  { symbol: "VCI", name: "CTCP Chứng khoán Vietcap", sector: "Dịch vụ tài chính", exchange: "HOSE", tier: "major" },
  { symbol: "HCM", name: "CTCP Chứng khoán TP.HCM (HSC)", sector: "Dịch vụ tài chính", exchange: "HOSE", tier: "major" },
  { symbol: "SHS", name: "CTCP Chứng khoán Sài Gòn - Hà Nội", sector: "Dịch vụ tài chính", exchange: "HNX", tier: "major" },
  { symbol: "MBS", name: "CTCP Chứng khoán MB", sector: "Dịch vụ tài chính", exchange: "HNX", tier: "major" },
  { symbol: "CTS", name: "CTCP Chứng khoán Ngân hàng Công thương", sector: "Dịch vụ tài chính", exchange: "HOSE", tier: "major" },
  { symbol: "BSI", name: "CTCP Chứng khoán BIDV", sector: "Dịch vụ tài chính", exchange: "HOSE", tier: "major" },
  { symbol: "HSG", name: "CTCP Tập đoàn Hoa Sen", sector: "Tài nguyên Cơ bản", exchange: "HOSE", tier: "major" },
  { symbol: "NKG", name: "CTCP Thép Nam Kim", sector: "Tài nguyên Cơ bản", exchange: "HOSE", tier: "major" },
  { symbol: "DGC", name: "CTCP Tập đoàn Hóa chất Đức Giang", sector: "Hóa chất", exchange: "HOSE", tier: "major" },
  { symbol: "DCM", name: "CTCP Phân bón Dầu khí Cà Mau (Đạm Cà Mau)", sector: "Hóa chất", exchange: "HOSE", tier: "major" },
  { symbol: "DPM", name: "Tổng Công ty Phân bón và Hóa chất Dầu khí (Đạm Phú Mỹ)", sector: "Hóa chất", exchange: "HOSE", tier: "major" },
  { symbol: "NVL", name: "CTCP Tập đoàn Đầu tư Địa ốc No Va (Novaland)", sector: "Bất động sản", exchange: "HOSE", tier: "major" },
  { symbol: "DIG", name: "Tổng CTCP Đầu tư Phát triển Xây dựng (DIC Corp)", sector: "Bất động sản", exchange: "HOSE", tier: "major" },
  { symbol: "DXG", name: "CTCP Tập đoàn Đất Xanh", sector: "Bất động sản", exchange: "HOSE", tier: "major" },
  { symbol: "PDR", name: "CTCP Phát triển Bất động sản Phát Đạt", sector: "Bất động sản", exchange: "HOSE", tier: "major" },
  { symbol: "KDH", name: "CTCP Đầu tư và Kinh doanh Nhà Khang Điền", sector: "Bất động sản", exchange: "HOSE", tier: "major" },
  { symbol: "KBC", name: "Tổng Công ty Phát triển Đô thị Kinh Bắc", sector: "Bất động sản", exchange: "HOSE", tier: "major" },
  { symbol: "NLG", name: "CTCP Đầu tư Nam Long", sector: "Bất động sản", exchange: "HOSE", tier: "major" },
  { symbol: "CEO", name: "CTCP Tập đoàn C.E.O", sector: "Bất động sản", exchange: "HNX", tier: "major" },
  { symbol: "VPI", name: "CTCP Đầu tư Văn Phú - Invest", sector: "Bất động sản", exchange: "HOSE", tier: "major" },
  { symbol: "HAG", name: "CTCP Hoàng Anh Gia Lai", sector: "Thực phẩm và đồ uống", exchange: "HOSE", tier: "major" },
  { symbol: "HNG", name: "CTCP Nông nghiệp Quốc tế Hoàng Anh Gia Lai", sector: "Thực phẩm và đồ uống", exchange: "UPCoM", tier: "major" },
  { symbol: "DBC", name: "CTCP Tập đoàn Dabaco Việt Nam", sector: "Thực phẩm và đồ uống", exchange: "HOSE", tier: "major" },
  { symbol: "BAF", name: "CTCP Nông nghiệp BAF Việt Nam", sector: "Thực phẩm và đồ uống", exchange: "HOSE", tier: "major" },
  { symbol: "VHC", name: "CTCP Vĩnh Hoàn", sector: "Thực phẩm và đồ uống", exchange: "HOSE", tier: "major" },
  { symbol: "ANV", name: "CTCP Nam Việt (Navico)", sector: "Thực phẩm và đồ uống", exchange: "HOSE", tier: "major" },
  { symbol: "PVD", name: "Tổng CTCP Khoan và Dịch vụ Khoan Dầu khí (PV Drilling)", sector: "Dầu khí", exchange: "HOSE", tier: "major" },
  { symbol: "PVS", name: "Tổng CTCP Dịch vụ Kỹ thuật Dầu khí Việt Nam (PTSC)", sector: "Dầu khí", exchange: "HNX", tier: "major" },
  { symbol: "BSR", name: "CTCP Lọc hóa dầu Bình Sơn", sector: "Dầu khí", exchange: "UPCoM", tier: "major" },
  { symbol: "OIL", name: "Tổng Công ty Dầu Việt Nam (PVOIL)", sector: "Dầu khí", exchange: "UPCoM", tier: "major" },
  { symbol: "REE", name: "CTCP Cơ Điện Lạnh REE", sector: "Hàng & Dịch vụ Công nghiệp", exchange: "HOSE", tier: "major" },
  { symbol: "PC1", name: "CTCP Tập đoàn PC1", sector: "Xây dựng và Vật liệu", exchange: "HOSE", tier: "major" },
  { symbol: "GEX", name: "CTCP Tập đoàn GELEX", sector: "Hàng & Dịch vụ Công nghiệp", exchange: "HOSE", tier: "major" },
  { symbol: "GMD", name: "CTCP Gemadept", sector: "Hàng & Dịch vụ Công nghiệp", exchange: "HOSE", tier: "major" },
  { symbol: "HAH", name: "CTCP Vận tải và Xếp dỡ Hải An", sector: "Hàng & Dịch vụ Công nghiệp", exchange: "HOSE", tier: "major" },
  { symbol: "FRT", name: "CTCP Bán lẻ Kỹ thuật số FPT (Long Châu)", sector: "Bán lẻ", exchange: "HOSE", tier: "major" },
  { symbol: "DGW", name: "CTCP Thế Giới Số (Digiworld)", sector: "Bán lẻ", exchange: "HOSE", tier: "major" },
  { symbol: "PNJ", name: "CTCP Vàng bạc Đá quý Phú Nhuận", sector: "Bán lẻ", exchange: "HOSE", tier: "major" },
  { symbol: "MSB", name: "Ngân hàng MSB", sector: "Ngân hàng", exchange: "HOSE", tier: "major" },
  { symbol: "LPB", name: "Ngân hàng LPBank", sector: "Ngân hàng", exchange: "HOSE", tier: "major" },
  { symbol: "OCB", name: "Ngân hàng Phương Đông (OCB)", sector: "Ngân hàng", exchange: "HOSE", tier: "major" },
  { symbol: "CTR", name: "Tổng Công ty CP Công trình Viettel", sector: "Viễn thông", exchange: "HOSE", tier: "major" },
  { symbol: "VGI", name: "Tổng Công ty CP Đầu tư Quốc tế Viettel", sector: "Viễn thông", exchange: "UPCoM", tier: "major" },
  { symbol: "VTP", name: "Tổng Công ty CP Bưu chính Viettel", sector: "Hàng & Dịch vụ Công nghiệp", exchange: "HOSE", tier: "major" },
  { symbol: "HVN", name: "Tổng Công ty Hàng không Việt Nam (Vietnam Airlines)", sector: "Du lịch và Giải trí", exchange: "HOSE", tier: "major" },
  { symbol: "HPB", name: "CTCP Bao bì Hải Phòng", sector: "Hàng & Dịch vụ Công nghiệp", exchange: "HNX", tier: "standard" },
];

function foldVietnamese(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function levenshtein(s1: string, s2: string): number {
  if (s1.length < s2.length) return levenshtein(s2, s1);
  if (s2.length === 0) return s1.length;

  let prev = Array.from({ length: s2.length + 1 }, (_, i) => i);
  for (let i = 0; i < s1.length; i++) {
    const curr = [i + 1];
    for (let j = 0; j < s2.length; j++) {
      const insertions = prev[j + 1] + 1;
      const deletions = curr[j] + 1;
      const substitutions = prev[j] + (s1[i] !== s2[j] ? 1 : 0);
      curr.push(Math.min(insertions, deletions, substitutions));
    }
    prev = curr;
  }
  return prev[s2.length];
}

export function matchStockQuery(
  rawQuery: string,
  limit = 4
): {
  exactMatches: StockDirectoryItem[];
  closestMatches: StockDirectoryItem[];
  isTypo: boolean;
} {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return { exactMatches: [], closestMatches: [], isTypo: false };
  }

  const upper = trimmed.toUpperCase();
  const folded = foldVietnamese(trimmed);

  // 1. Check direct symbol or name substring matches
  const exactScored: Array<{ score: number; item: StockDirectoryItem }> = [];
  for (const item of STOCK_DIRECTORY) {
    const symUpper = item.symbol.toUpperCase();
    const nameFolded = foldVietnamese(item.name);

    if (symUpper === upper) {
      exactScored.push({ score: 200, item });
    } else if (symUpper.startsWith(upper) && upper.length >= 2) {
      const tierBonus = item.tier === "vn30" ? 20 : item.tier === "major" ? 10 : 0;
      exactScored.push({ score: 140 + tierBonus, item });
    } else if (folded.length >= 2 && nameFolded.includes(folded)) {
      const tierBonus = item.tier === "vn30" ? 20 : item.tier === "major" ? 10 : 0;
      exactScored.push({ score: 110 + tierBonus, item });
    }
  }

  if (exactScored.length > 0) {
    exactScored.sort((a, b) => b.score - a.score);
    return {
      exactMatches: exactScored.slice(0, limit).map((x) => x.item),
      closestMatches: [],
      isTypo: false,
    };
  }

  // 2. Fuzzy typo matching for potential mistyped ticker tokens (2 to 6 chars)
  if (!/^[A-Z0-9]{2,6}$/.test(upper)) {
    return { exactMatches: [], closestMatches: [], isTypo: false };
  }

  const fuzzyScored: Array<{ score: number; item: StockDirectoryItem }> = [];
  for (const item of STOCK_DIRECTORY) {
    const sym = item.symbol;
    if (Math.abs(upper.length - sym.length) > 2) continue;

    const dist = levenshtein(upper, sym);
    if (dist > 2) continue;

    let score = 100 - dist * 30;
    if (item.tier === "vn30") score += 25;
    else if (item.tier === "major") score += 15;

    // Vietnamese B/P phonetic confusion (e.g. HBG -> HPG)
    if ((upper.includes("B") && sym.includes("P")) || (upper.includes("P") && sym.includes("B"))) {
      score += 12;
    }

    // First letter match
    if (upper[0] === sym[0]) {
      score += 8;
    }

    // Substring containment (e.g. VICC -> VIC, TCBB -> TCB, MB -> MBB)
    if (upper.includes(sym) || sym.includes(upper)) {
      score += 15;
    }

    fuzzyScored.push({ score, item });
  }

  fuzzyScored.sort((a, b) => b.score - a.score);
  const closestMatches = fuzzyScored.slice(0, limit).map((x) => x.item);

  return {
    exactMatches: [],
    closestMatches,
    isTypo: closestMatches.length > 0,
  };
}
