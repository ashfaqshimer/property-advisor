import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://propertyadvisor.lk"
  ).replace(/\/+$/, "");

  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
  ];
}
