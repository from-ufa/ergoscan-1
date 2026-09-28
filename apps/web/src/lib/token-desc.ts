export type TokenDescLine = { key?: string; value: string };

function formatDescValue(v: unknown): string {
  if (v == null) return String(v);
  if (typeof v === "string") return v;
  if (typeof v === "boolean" || typeof v === "number" || typeof v === "bigint") {
    return String(v);
  }
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Drop C0 controls that break layout. Keep newlines, tabs, emoji, and the rest of Unicode. */
function visibleDesc(raw: string): string {
  return raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
}

function tryParseJson(raw: string): unknown {
  try {
    let v: unknown = JSON.parse(raw);
    if (typeof v === "string") {
      const inner = v.trim();
      if (
        (inner.startsWith("{") && inner.endsWith("}")) ||
        (inner.startsWith("[") && inner.endsWith("]"))
      ) {
        try {
          v = JSON.parse(inner);
        } catch {
          /* keep the outer string */
        }
      }
    }
    return v;
  } catch {
    return null;
  }
}

function jsonObjectSlice(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return raw.slice(start, end + 1);
}

function asObjectLines(parsed: unknown): TokenDescLine[] | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (!entries.length) return null;
  return entries.map(([key, value]) => ({ key, value: formatDescValue(value) }));
}

/** EIP-4 JSON blobs → `key: value` lines. Plain text, including emoji, stays as written. */
export function tokenDescLines(raw: string): TokenDescLine[] {
  const trimmed = visibleDesc(raw);
  if (!trimmed) return [];
  const direct = asObjectLines(tryParseJson(trimmed));
  if (direct) return direct;
  const embedded = jsonObjectSlice(trimmed);
  if (embedded && embedded !== trimmed) {
    const inner = asObjectLines(tryParseJson(embedded));
    if (inner) return inner;
  }
  return [{ value: trimmed }];
}
