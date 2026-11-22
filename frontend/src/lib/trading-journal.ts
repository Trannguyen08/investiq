export type TradeJournalEntry = {
  id: string;
  orderId?: string;
  symbol: string;
  side: "buy" | "sell";
  note: string;
  createdAt: string;
};

const JOURNAL_STORAGE_KEY = "investiq.paper.journal.v1";
const MAX_ENTRIES = 200;

export function loadTradeJournalEntries(): TradeJournalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is TradeJournalEntry =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as TradeJournalEntry).id === "string" &&
        typeof (item as TradeJournalEntry).note === "string",
    );
  } catch {
    return [];
  }
}

export function loadTradeJournalMap(): Record<string, string> {
  const entries = loadTradeJournalEntries();
  const map: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.id) map[entry.id] = entry.note;
    if (entry.orderId) map[entry.orderId] = entry.note;
  }
  return map;
}

export function saveTradeJournalEntry(entry: TradeJournalEntry): TradeJournalEntry[] {
  const trimmed = entry.note.trim().slice(0, 200);
  if (!trimmed || typeof window === "undefined") return loadTradeJournalEntries();
  const existing = loadTradeJournalEntries().filter(
    (item) => item.id !== entry.id && (!entry.orderId || item.orderId !== entry.orderId),
  );
  const next = [{ ...entry, note: trimmed }, ...existing].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota/private-mode storage errors
  }
  return next;
}
