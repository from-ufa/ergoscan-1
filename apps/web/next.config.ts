import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ergoscan/shared", "@lumen/amm-chart", "echarts", "zrender"],
  async redirects() {
    return [
      { source: "/richlist", destination: "/addresses", permanent: true },
      { source: "/operators/oracles", destination: "/oracles", permanent: false },
      // Nautilus opens /transactions/:id and /addresses/:id. Our pages are /tx and /address.
      { source: "/transactions/:id", destination: "/tx/:id", permanent: true },
      { source: "/addresses/:id", destination: "/address/:id", permanent: true },
    ];
  },
};

export default nextConfig;
