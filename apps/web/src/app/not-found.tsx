import type { Metadata } from "next";
import { NotFoundClient } from "./not-found-client";

export const metadata: Metadata = {
  title: "Not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NotFoundClient />;
}
