import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // happy-dom (used by @tiptap/html on the server) and mammoth are Node-only.
  serverExternalPackages: ["happy-dom", "mammoth"],
};

export default nextConfig;
