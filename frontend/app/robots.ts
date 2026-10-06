import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://propertyadvisor.lk"
  ).replace(/\/+$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/login", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
