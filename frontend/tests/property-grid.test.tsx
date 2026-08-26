import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PropertyCard from "@/components/properties/PropertyCard";
import { PropertyGridContent } from "@/components/properties/PropertyGrid";
import { FEATURED_PROPERTIES, type Property } from "@/lib/properties";

/** A card is only ever rendered from fixture data, so tests start from one. */
const sample: Property = FEATURED_PROPERTIES[0];

describe("PropertyGrid", () => {
  it("renders one card per fixture", () => {
    const { container } = render(<PropertyGridContent properties={FEATURED_PROPERTIES} />);

    // Counted off the fixture length, not a literal, so dropping or adding a
    // listing does not need a test edit — including to an odd number.
    expect(container.querySelectorAll("article")).toHaveLength(
      FEATURED_PROPERTIES.length,
    );
  });

  it("takes its accessible name from the heading, not a duplicate label", () => {
    render(<PropertyGridContent properties={FEATURED_PROPERTIES} />);
    const section = screen.getByRole("region", { name: "Featured properties" });

    expect(section).toHaveAttribute(
      "aria-labelledby",
      "featured-properties-heading",
    );
    expect(section).not.toHaveAttribute("aria-label");
  });

  it("renders the section header above the cards", () => {
    render(<PropertyGridContent properties={FEATURED_PROPERTIES} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Featured properties" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Handpicked for you")).toBeInTheDocument();
    expect(screen.getByText(/A curated selection across Colombo/)).toBeInTheDocument();
  });

  it("titles every card at h3, one level below the section heading", () => {
    render(<PropertyGridContent properties={FEATURED_PROPERTIES} />);

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(
      FEATURED_PROPERTIES.length,
    );
  });
});

describe("PropertyCard", () => {
  it("renders the title, price, and description from its property", () => {
    render(<PropertyCard property={sample} />);

    expect(
      screen.getByRole("heading", { level: 3, name: sample.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(sample.priceLkr)).toBeInTheDocument();
    expect(screen.getByText(sample.description)).toBeInTheDocument();
    expect(screen.getByText(sample.location)).toBeInTheDocument();
  });

  it("gives the photo alt text describing the image, not the title", () => {
    render(<PropertyCard property={sample} />);
    const image = screen.getByRole("img");

    expect(image).toHaveAccessibleName(sample.imageAlt);
    expect(image).not.toHaveAccessibleName(sample.title);
  });

  it("thousands-separates the floor area", () => {
    render(<PropertyCard property={sample} />);

    expect(screen.getByText("4,200 sqft")).toBeInTheDocument();
  });

  it.each([
    [1, "1 bed", "1 bath"],
    [2, "2 beds", "2 baths"],
  ])("pluralises meta for %i", (count, beds, baths) => {
    render(
      <PropertyCard property={{ ...sample, beds: count, baths: count }} />,
    );

    expect(screen.getByText(beds)).toBeInTheDocument();
    expect(screen.getByText(baths)).toBeInTheDocument();
  });

  it("stays non-interactive — detail pages do not exist yet", () => {
    const { container } = render(<PropertyCard property={sample} />);

    expect(container.querySelectorAll("a, button")).toHaveLength(0);
  });

  it("marks its icons decorative so meta reads as text alone", () => {
    const { container } = render(<PropertyCard property={sample} />);
    const svgs = container.querySelectorAll("svg");

    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("holds the image box on a fixed ratio so a dead URL cannot collapse the row", () => {
    const { container } = render(<PropertyCard property={sample} />);

    // Class-presence guard, not a layout assertion — jsdom computes no boxes.
    // Catches accidental removal of the ratio.
    expect(container.querySelector(".aspect-4\\/3")).toBeInTheDocument();
  });
});

describe("property fixtures", () => {
  it("gives every listing the fields a card renders", () => {
    for (const property of FEATURED_PROPERTIES) {
      expect(property.imageUrl).toMatch(
        /^https:\/\/images\.unsplash\.com\/photo-/,
      );
      expect(property.imageAlt.length).toBeGreaterThan(0);
      expect(property.priceLkr).toMatch(/^LKR /);
      expect(property.beds).toBeGreaterThan(0);
      expect(property.baths).toBeGreaterThan(0);
      expect(property.sqft).toBeGreaterThan(0);
    }
  });

  it("keys cards on ids that are unique", () => {
    const ids = FEATURED_PROPERTIES.map((p) => p.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("renders each fixture's title exactly once in the grid", () => {
    render(<PropertyGridContent properties={FEATURED_PROPERTIES} />);
    const grid = screen.getByRole("region", { name: "Featured properties" });

    for (const property of FEATURED_PROPERTIES) {
      expect(
        within(grid).getByRole("heading", { level: 3, name: property.title }),
      ).toBeInTheDocument();
    }
  });
});
