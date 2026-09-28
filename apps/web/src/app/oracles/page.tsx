import { listPageMeta } from "@/lib/page-meta";
import { OraclesDoor } from "./oracles-door";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/oracles");

export default function OraclesPage() {
  return <OraclesDoor />;
}
