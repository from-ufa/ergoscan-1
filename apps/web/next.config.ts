import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ergoscan/shared", "@lumen/amm-chart", "echarts", "zrender"],
  async redirects() {
    return [
      { source: "/richlist", destination: "/addresses", permanent: true },
      { source: "/operators/oracles", destination: "/oracles", permanent: false },
    ];
  },
};

export default nextConfig;
