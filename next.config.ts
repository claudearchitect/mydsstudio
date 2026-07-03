import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray lockfile in a parent directory
  // (outside this repo) otherwise makes Next.js guess the wrong root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
