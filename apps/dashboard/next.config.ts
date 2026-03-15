import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@openclaw/contracts"],
};

export default nextConfig;
