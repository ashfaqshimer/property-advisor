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
    // When BACKEND_URL is set (e.g., in Vercel production), proxy /api requests to the Render backend.
    // This avoids cross-origin cookie rejection (SameSite=Lax) on the frontend.
    // Set NEXT_PUBLIC_API_URL=/api in your Vercel environment so the browser calls the proxy.
    if (process.env.BACKEND_URL) {
      return [
        {
          source: "/api/:path*",
          destination: `${process.env.BACKEND_URL.replace(/\/+$/, '')}/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
