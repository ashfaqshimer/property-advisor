import { getSiteConfiguration, type SiteConfiguration } from "@/lib/api";

export default async function JsonLd() {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://propertyadvisor.lk"
  ).replace(/\/+$/, "");

  let siteConfig: SiteConfiguration | null = null;
  try {
    siteConfig = await getSiteConfiguration();
  } catch {
    // Graceful degradation when backend is unreachable during build or SSR
  }

  const socialLinks: string[] = [];
  if (siteConfig?.facebook_link?.value) socialLinks.push(siteConfig.facebook_link.value);
  if (siteConfig?.instagram_link?.value) socialLinks.push(siteConfig.instagram_link.value);
  if (siteConfig?.x_link?.value) socialLinks.push(siteConfig.x_link.value);

  const phoneNumbers = siteConfig?.phone_numbers?.values?.filter(Boolean) || [];
  const contactEmail = siteConfig?.contact_email?.value || undefined;

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "RealEstateAgent",
        "@id": `${siteUrl}/#organization`,
        name: "Property Advisor",
        url: siteUrl,
        logo: `${siteUrl}/Property_Advisor_Logo_Vector.svg`,
        image: `${siteUrl}/images/hero_apartment.jpg`,
        description:
          "Expert real estate partner in Sri Lanka. Buy, sell, rent, or get professional property advice powered by Amaya AI.",
        areaServed: [
          {
            "@type": "City",
            name: "Colombo",
          },
          {
            "@type": "Country",
            name: "Sri Lanka",
          },
        ],
        address: {
          "@type": "PostalAddress",
          addressLocality: siteConfig?.city?.value || "Colombo",
          addressCountry: "LK",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: 6.9271,
          longitude: 79.8612,
        },
        ...(phoneNumbers.length > 0 ? { telephone: phoneNumbers[0] } : {}),
        ...(contactEmail ? { email: contactEmail } : {}),
        ...(socialLinks.length > 0 ? { sameAs: socialLinks } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "Property Advisor",
        description:
          "Property in Colombo and across Sri Lanka. Curated prime listings and AI-guided real estate advisory.",
        publisher: {
          "@id": `${siteUrl}/#organization`,
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
