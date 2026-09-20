import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /*
      Property photos are Unsplash stand-ins until real listings exist — see the
      note at the top of lib/properties.ts. Scoped to the one host serving them.

      `search` is deliberately left unset. Setting it to "" would reject any URL
      carrying a query string, and the fixture URLs pass `?w=1600&q=75&…` so the
      optimizer downloads a sane source rather than a multi-megabyte original.
    */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/photo-**",
      },
    ],
  },
  async rewrites() {
    // In production (Vercel), BACKEND_URL proxies /api/* to the Render backend,
    // avoiding cross-origin cookie rejection (SameSite=Lax).
    // In local dev, fall back to localhost:8000 so the rewrite always activates
    // and NEXT_PUBLIC_API_URL=/api works without restarting the dev server.
    const backendUrl =
      process.env.BACKEND_URL?.replace(/\/+$/, "") ?? "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
