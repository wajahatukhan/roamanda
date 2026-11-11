import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Only the hotel page's lead photo goes through the optimiser; thumbnails are plain images.
    // Keep this in step with OPTIMISED_IMAGE_HOST / OPTIMISED_IMAGE_PATH_PREFIX in src/lib/content/image-url.ts.
    remotePatterns: [{ protocol: "https", hostname: "cdn.worldota.net", port: "", pathname: "/t/**", search: "" }],
    formats: ["image/avif", "image/webp"],
    // The supplier files are at most 1024 px wide and the optimiser never enlarges, so wider variants would only be copies.
    deviceSizes: [640, 1080],
    imageSizes: [384],
  },
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
