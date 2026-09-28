import { listPageMeta } from "@/lib/page-meta";
import { FavoritesView } from "./favorites-view";

export const metadata = listPageMeta("/favorites");

export default function FavoritesPage() {
  return <FavoritesView />;
}
