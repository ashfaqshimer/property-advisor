import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AdminUserMenu from "@/components/admin/AdminUserMenu";
import type { AuthUser } from "@/lib/api";

const mockUser: AuthUser = {
  id: "user-1",
  name: "John Doe",
  email: "john@example.com",
  role: "root",
  created_at: "2026-01-01T00:00:00Z",
};

describe("AdminUserMenu", () => {
  it("renders Welcome greeting with user name and email address", () => {
    render(<AdminUserMenu user={mockUser} onSignOut={vi.fn()} />);

    expect(screen.getByText("Welcome,")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
  });

  it("renders the user avatar with their initial", () => {
    render(<AdminUserMenu user={mockUser} onSignOut={vi.fn()} />);

    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("starts with the dropdown menu closed", () => {
    render(<AdminUserMenu user={mockUser} onSignOut={vi.fn()} />);

    const button = screen.getByRole("button", { name: /user menu for john doe/i });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /sign out/i })).not.toBeInTheDocument();
  });

  it("opens the dropdown menu when clicked", () => {
    render(<AdminUserMenu user={mockUser} onSignOut={vi.fn()} />);

    const button = screen.getByRole("button", { name: /user menu for john doe/i });
    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.getByText("Signed in as")).toBeInTheDocument();
    expect(screen.getByText("root")).toBeInTheDocument();
  });

  it("calls onSignOut when the Sign out button is clicked", () => {
    const handleSignOut = vi.fn();
    render(<AdminUserMenu user={mockUser} onSignOut={handleSignOut} />);

    const button = screen.getByRole("button", { name: /user menu for john doe/i });
    fireEvent.click(button);

    const signOutButton = screen.getByRole("menuitem", { name: /sign out/i });
    fireEvent.click(signOutButton);

    expect(handleSignOut).toHaveBeenCalledTimes(1);
  });

  it("displays spinner and disables the Sign out button when signingOut is true", () => {
    render(<AdminUserMenu user={mockUser} onSignOut={vi.fn()} signingOut={true} />);

    const button = screen.getByRole("button", { name: /user menu for john doe/i });
    fireEvent.click(button);

    const signOutButton = screen.getByRole("menuitem", { name: /sign out/i });
    expect(signOutButton).toBeDisabled();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("closes on Escape key press and restores focus to trigger button", () => {
    render(<AdminUserMenu user={mockUser} onSignOut={vi.fn()} />);

    const button = screen.getByRole("button", { name: /user menu for john doe/i });
    fireEvent.click(button);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("closes when clicking outside the menu", () => {
    render(
      <div>
        <div data-testid="outside">Outside area</div>
        <AdminUserMenu user={mockUser} onSignOut={vi.fn()} />
      </div>
    );

    const button = screen.getByRole("button", { name: /user menu for john doe/i });
    fireEvent.click(button);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("falls back gracefully when user name is empty", () => {
    const fallbackUser: AuthUser = {
      ...mockUser,
      name: "",
      email: "agent@propertyadvisor.com",
      role: "agent",
    };
    render(<AdminUserMenu user={fallbackUser} onSignOut={vi.fn()} />);

    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
