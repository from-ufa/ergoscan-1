/** Thin Ergo node REST client */

export function createNodeClient(baseUrl: string) {
  const base = baseUrl.replace(/\/$/, "");

  async function get<T = unknown>(path: string, timeoutMs = 8000): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`node ${res.status} ${path} ${text.slice(0, 120)}`);
    }
    return (await res.json()) as T;
  }

  async function post<T = unknown>(path: string, body: unknown, timeoutMs = 10000): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`node ${res.status} POST ${path} ${text.slice(0, 120)}`);
    }
    return (await res.json()) as T;
  }

  return { base, get, post };
}

export type NodeClient = ReturnType<typeof createNodeClient>;
