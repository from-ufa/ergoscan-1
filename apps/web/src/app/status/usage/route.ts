import { readApiUse } from "@/lib/api-use-read";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = await readApiUse();
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
