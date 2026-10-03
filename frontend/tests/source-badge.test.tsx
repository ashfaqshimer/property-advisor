import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SourceBadge } from "@/components/admin/SourceBadge";

describe("SourceBadge", () => {
  it("defaults to ikman.lk when no source or 'ikman' is provided", () => {
    const { rerender } = render(<SourceBadge />);
    expect(screen.getByText("ikman.lk")).toBeInTheDocument();

    rerender(<SourceBadge source="ikman" />);
    expect(screen.getByText("ikman.lk")).toBeInTheDocument();
  });

  it("renders LPW when source is lpw or lankapropertyweb", () => {
    const { rerender } = render(<SourceBadge source="lpw" />);
    expect(screen.getByText("LPW")).toBeInTheDocument();

    rerender(<SourceBadge source="lankapropertyweb" />);
    expect(screen.getByText("LPW")).toBeInTheDocument();
  });

  it("renders an external link when url is provided", () => {
    render(<SourceBadge source="ikman" url="https://ikman.lk/en/ad/123" />);

    const link = screen.getByRole("link", { name: /view original listing on ikman\.lk/i });
    expect(link).toHaveAttribute("href", "https://ikman.lk/en/ad/123");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
