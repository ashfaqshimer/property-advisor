import type { PropertyApiRecord } from "@/lib/api";

/**
 * Card presentation data. API records are mapped here so snake_case wire fields do not
 * leak into the UI components.
 *
 * Eight illustrative listings so the grid has something real to lay out. The
 * names, prices, and copy come from `context/ui-interface.png`, which is
 * reference art: none of these properties exist. Photos are Unsplash
 * stand-ins, allow-listed in `next.config.ts`.
 *
 * When the API lands, this file becomes the response type and the array goes
 * away — keep `Property` shaped like the eventual payload so that swap stays
 * mechanical.
 */

export type Property = {
  id: string;
  title: string;
  /** Neighbourhood or city, as shown in the pill over the photo. */
  location: string;
  /** Pre-formatted for display — the API will send a number and a currency. */
  priceLkr: string;
  description: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  imageUrl: string | null;
  /** Describes the photo, not the listing — the title is already adjacent. */
  imageAlt: string;
};

export function formatPrice(price: number, currency: "LKR"): string {
  if (price >= 1_000_000 && price % 1_000_000 === 0) {
    return `${currency} ${(price / 1_000_000).toLocaleString("en-US")}M`;
  }
  return `${currency} ${price.toLocaleString("en-US")}`;
}

export function mapProperty(record: PropertyApiRecord): Property {
  return {
    id: record.id,
    title: record.title,
    location: record.location,
    priceLkr: formatPrice(record.price, record.currency),
    description: record.description,
    beds: record.bedrooms,
    baths: record.bathrooms,
    sqft: record.sqft,
    imageUrl: record.image_urls[0] ?? null,
    imageAlt: record.image_alt,
  };
}

/** Shared Unsplash transform: caps the source the optimizer downloads. */
const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=1600&q=75&auto=format&fit=crop`;

export const FEATURED_PROPERTIES: Property[] = [
  {
    id: "garden-villa-ward-place",
    title: "Garden Villa on Ward Place",
    location: "Colombo 7",
    priceLkr: "LKR 185M",
    description:
      "A serene modern villa with mature gardens in the heart of Cinnamon Gardens.",
    beds: 5,
    baths: 4,
    sqft: 4200,
    imageUrl: photo("1613490493576-7fde63acd811"),
    imageAlt:
      "Two-storey white villa with a timber-lined upper deck beside a long lap pool",
  },
  {
    id: "havelock-residences",
    title: "Havelock Residences",
    location: "Colombo 5",
    priceLkr: "LKR 48M",
    description:
      "Light-filled apartment moments from Havelock Town cafés and schools.",
    beds: 3,
    baths: 2,
    sqft: 1650,
    imageUrl: photo("1545324418-cc1a3fa10c00"),
    imageAlt:
      "Upper floors and balconies of a contemporary apartment building at dusk",
  },
  {
    id: "courtyard-townhouse",
    title: "Courtyard Townhouse",
    location: "Rajagiriya",
    priceLkr: "LKR 72M",
    description:
      "A quiet, low-maintenance townhouse with a private inner courtyard.",
    beds: 4,
    baths: 3,
    sqft: 2400,
    imageUrl: photo("1600585154340-be6161a56a0c"),
    imageAlt:
      "Dark timber-clad townhouse set back behind a mature tree and clipped lawn",
  },
  {
    id: "skyline-penthouse",
    title: "Skyline Penthouse",
    location: "Colombo 3",
    priceLkr: "LKR 240M",
    description:
      "Panoramic city and ocean views from a full-floor Kollupitiya penthouse.",
    beds: 3,
    baths: 3,
    sqft: 3100,
    imageUrl: photo("1600607687939-ce8a6c25118c"),
    imageAlt:
      "Open-plan living room with a timber feature wall and full-height glazing onto a terrace",
  },
  {
    id: "restored-colonial-retreat",
    title: "Restored Colonial Retreat",
    location: "Galle",
    priceLkr: "LKR 130M",
    description:
      "A lovingly restored coastal home within the historic Fort quarter.",
    beds: 4,
    baths: 3,
    sqft: 2800,
    imageUrl: photo("1570129477492-45c003edd2be"),
    imageAlt:
      "Grey clapboard colonial house with a white wraparound veranda and front lawn",
  },
  {
    id: "hillside-bungalow",
    title: "Hillside Bungalow",
    location: "Kandy",
    priceLkr: "LKR 95M",
    description: "Wrapped in misty hills, a calm escape with wide valley views.",
    beds: 4,
    baths: 3,
    sqft: 2600,
    imageUrl: photo("1568605114967-8130f3a36994"),
    imageAlt:
      "Gabled timber house lit from within at dusk, framed by a wooded hillside",
  },
  {
    id: "poolside-garden-house",
    title: "Poolside Garden House",
    location: "Colombo 7",
    priceLkr: "LKR 160M",
    description: "Single-storey living that opens fully onto a lawn and lap pool.",
    beds: 4,
    baths: 4,
    sqft: 3600,
    imageUrl: photo("1512917774080-9991f1c4c750"),
    imageAlt:
      "Single-storey white villa with sliding glass doors opening onto a pool terrace",
  },
  {
    id: "beachside-terrace-house",
    title: "Beachside Terrace House",
    location: "Mount Lavinia",
    priceLkr: "LKR 88M",
    description: "A breezy home with a rooftop terrace, steps from the shoreline.",
    beds: 3,
    baths: 3,
    sqft: 2100,
    imageUrl: photo("1564013799919-ab600027ffc6"),
    imageAlt:
      "White two-storey house with balconies and palms above a curved pool",
  },
];
