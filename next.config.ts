import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // package.json (up to 1 MB) plus a gzipped package-lock.json (10 MB
      // inflates from about 1 MB). The default is 1 MB; Vercel itself caps a
      // request body at 4.5 MB.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
