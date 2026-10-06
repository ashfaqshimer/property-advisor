export type LocationMeta = {
  slug: string;
  name: string;
  district: string;
  description: string;
  highlights: string[];
};

export const CITIES: LocationMeta[] = [
  {
    slug: "colombo",
    name: "Colombo",
    district: "Colombo",
    description:
      "The premier commercial capital of Sri Lanka, offering luxury seafront high-rises, colonial residences, and prestigious residential corridors across Colombo 03, 04, and 07.",
    highlights: [
      "Colombo 03 (Kollupitiya)",
      "Colombo 07 (Cinnamon Gardens)",
      "Colombo 04 (Bambalapitiya)",
      "Port City & Galle Face skyline",
    ],
  },
  {
    slug: "rajagiriya",
    name: "Rajagiriya",
    district: "Colombo Suburb",
    description:
      "Premier residential enclave bordering Colombo, renowned for luxury condominium towers, wetland sanctuaries, and seamless access to central business districts.",
    highlights: [
      "Waters Edge & Diyatha Uyana",
      "Luxury high-rise condominiums",
      "Parliament road expressway corridor",
      "Serene canal and wetland views",
    ],
  },
  {
    slug: "nugegoda",
    name: "Nugegoda",
    district: "Colombo Suburb",
    description:
      "High-demand family residential hub celebrated for top-tier educational institutions, retail centers, and architect-designed private residences.",
    highlights: [
      "High Level Road connectivity",
      "Leading schools and universities",
      "Modern multi-story family houses",
      "High rental yield and liquidity",
    ],
  },
  {
    slug: "dehiwala",
    name: "Dehiwala",
    district: "Colombo Suburb",
    description:
      "Coastal suburb offering ocean-facing apartment complexes, convenient transit via Galle Road and Marine Drive, and diverse lifestyle amenities.",
    highlights: [
      "Marine Drive oceanfront properties",
      "Easy rail & road access to Colombo Fort",
      "Suburban residential streets",
      "Vibrant culinary and shopping district",
    ],
  },
  {
    slug: "mount-lavinia",
    name: "Mount Lavinia",
    district: "Colombo Suburb",
    description:
      "Famed coastal retreat blending historic colonial architecture, golden sand beaches, luxury holiday condominiums, and seaside dining.",
    highlights: [
      "Mount Lavinia beach promenade",
      "Luxury beachfront apartments",
      "Historic colonial residential pockets",
      "Popular tourist and expat destination",
    ],
  },
  {
    slug: "battaramulla",
    name: "Battaramulla",
    district: "Colombo Suburb",
    description:
      "The administrative capital corridor featuring upscale residential neighborhoods, international schools, government ministries, and leafy lakefront streets.",
    highlights: [
      "Pelawatte & Parliament parklands",
      "Diyawanna Lake walking trails",
      "Gated residential communities",
      "Diplomatic and executive homes",
    ],
  },
  {
    slug: "kandy",
    name: "Kandy",
    district: "Central Province",
    description:
      "Sri Lanka's historic hill capital nestled amongst lush mountain ranges, tea plantations, and heritage homes with cool upland climates.",
    highlights: [
      "Panoramic hillside properties",
      "Kandy Lake & scenic valleys",
      "Tea country estates & bungalows",
      "Central Expressway connectivity",
    ],
  },
  {
    slug: "galle",
    name: "Galle",
    district: "Southern Province",
    description:
      "World-famous Southern coastal capital with UNESCO heritage fortress, turquoise beaches, luxury holiday villas, and high-growth tourism developments.",
    highlights: [
      "Galle Fort historic merchant villas",
      "Thalpe & Unawatuna beachfront land",
      "High-end vacation rental investments",
      "Direct Southern Expressway link (75 mins to Colombo)",
    ],
  },
  {
    slug: "negombo",
    name: "Negombo",
    district: "Western Province",
    description:
      "Strategic coastal city situated adjacent to Bandaranaike International Airport, featuring lagoon canals, beach resorts, and prime commercial and residential parcels.",
    highlights: [
      "Airport proximity (15 minutes)",
      "Beachfront hotels and villas",
      "Dutch canal & lagoon waterfront properties",
      "Colombo-Katunayake expressway connection",
    ],
  },
];

export function getLocationBySlug(slug: string): LocationMeta | undefined {
  return CITIES.find((c) => c.slug.toLowerCase() === slug.toLowerCase());
}
