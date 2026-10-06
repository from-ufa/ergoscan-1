/** Extension section stored as node bytes: header id, count, then key, length, value. */

export type ExtensionField = { key: string; value: string };

export type ExtensionParts = {
  headerId: string;
  fields: ExtensionField[];
};

export function splitExtension(hex: string): ExtensionParts | null {
  const raw = hex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(raw) || raw.length < 68 || raw.length % 2 !== 0) return null;
  const headerId = raw.slice(0, 64);
  const count = Number.parseInt(raw.slice(64, 68), 16);
  if (!Number.isFinite(count)) return null;
  const fields: ExtensionField[] = [];
  let i = 68;
  for (let n = 0; n < count; n++) {
    if (i + 6 > raw.length) return null;
    const key = raw.slice(i, i + 4);
    const len = Number.parseInt(raw.slice(i + 4, i + 6), 16);
    const start = i + 6;
    const end = start + len * 2;
    if (!Number.isFinite(len) || end > raw.length) return null;
    fields.push({ key, value: raw.slice(start, end) });
    i = end;
  }
  if (i !== raw.length) return null;
  return { headerId, fields };
}
