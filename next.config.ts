import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// DHCP can change the computer's address between phone-testing sessions.
const lanHosts = Object.values(networkInterfaces())
  .flatMap((addresses) => addresses ?? [])
  .filter(
    ({ family, internal, address }) =>
      family === "IPv4" &&
      !internal &&
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address),
  )
  .map(({ address }) => address);

const nextConfig: NextConfig = {
  allowedDevOrigins: [...new Set(lanHosts)],
  experimental: {
    agentFeedback: true,
    serverActions: { bodySizeLimit: "6mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
