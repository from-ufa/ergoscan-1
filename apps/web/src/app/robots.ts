import type { MetadataRoute } from "next";
import { ROBOTS_DISALLOW } from "@/lib/page-meta";
import { SITE_URL } from "@/lib/site-meta";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...ROBOTS_DISALLOW],
      },
      {
        userAgent: [
          "AhrefsBot",
          "SemrushBot",
          "DotBot",
          "MJ12bot",
          "Bytespider",
          "PetalBot",
          "GPTBot",
          "ClaudeBot",
          "CCBot",
          "Amazonbot",
          "Baiduspider",
        ],
        disallow: ["/address/", "/api/", "/v1/", "/_ops", "/_ops/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
