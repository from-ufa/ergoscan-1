/**
 * Official POST /boxes/search bodies.
 * Only ergoTreeTemplateHash is served. It uses packed.box_template.
 * A register, constant, or token list would scan every box of that template.
 */

export type TemplateSearch =
  | { ok: true; hash: string }
  | { ok: false; status: 400 | 501; error: string; reason: string };

const HEX64 = /^[0-9a-f]{64}$/;

function filledMap(value: unknown): boolean {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length > 0
  );
}

function filledList(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

/** Template hash only. Empty registers, constants, or assets are not a predicate. */
export function parseTemplateOnlySearch(body: unknown): TemplateSearch {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      status: 400,
      error: "bad_request",
      reason: "JSON object with ergoTreeTemplateHash required",
    };
  }
  const rec = body as Record<string, unknown>;
  if (filledMap(rec.registers) || filledMap(rec.constants) || filledList(rec.assets)) {
    return {
      ok: false,
      status: 501,
      error: "not_implemented",
      reason: "register, constant, and token predicates stay 501",
    };
  }
  const hash =
    typeof rec.ergoTreeTemplateHash === "string" ? rec.ergoTreeTemplateHash.trim().toLowerCase() : "";
  if (!HEX64.test(hash)) {
    return {
      ok: false,
      status: 400,
      error: "bad_request",
      reason: "ergoTreeTemplateHash must be 64 hex chars",
    };
  }
  return { ok: true, hash };
}
