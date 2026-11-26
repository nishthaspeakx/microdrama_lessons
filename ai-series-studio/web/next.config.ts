import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // This app lives inside a larger repository; pin the workspace root to it.
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["pg"],
};

export default nextConfig;
