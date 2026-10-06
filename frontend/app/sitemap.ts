import type { MetadataRoute } from "next";
import { getFeaturedProperties } from "@/lib/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://propertyadvisor.lk"
  ).replace(/\/+$/, "");

  const routes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
  ];

  try {
    const properties = await getFeaturedProperties(50);
    for (const prop of properties) {
      routes.push({
        url: `${siteUrl}/properties/${prop.id}`,
        lastModified: prop.created_at ? new Date(prop.created_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch {
    // Graceful fallback during isolated builds
  }

  return routes;
}
