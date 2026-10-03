import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ScanLauncherDrawer, DEFAULT_PRESETS } from "@/components/admin/ScanLauncherDrawer";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    startProspectScan: vi.fn(),
    getScanPresets: vi.fn().mockResolvedValue([]),
    saveScanPreset: vi.fn(),
    deleteScanPreset: vi.fn(),
  };
});


describe("ScanLauncherDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(
      <ScanLauncherDrawer
        isOpen={false}
        onClose={vi.fn()}
        onScanStarted={vi.fn()}
      />
    );

    expect(screen.queryByText("Start Real Estate Scan")).not.toBeInTheDocument();
  });

  it("renders with source cards, quick location pills, and inputs when open", () => {
    render(
      <ScanLauncherDrawer
        isOpen={true}
        onClose={vi.fn()}
        onScanStarted={vi.fn()}
      />
    );

    expect(screen.getByText("Start Real Estate Scan")).toBeInTheDocument();
    expect(screen.getByText("ikman.lk")).toBeInTheDocument();
    expect(screen.getByText("LankaPropertyWeb")).toBeInTheDocument();
    expect(screen.getByText("Rajagiriya")).toBeInTheDocument();
    expect(screen.getByText("Colombo 7")).toBeInTheDocument();
  });

  it("populates location keyword when clicking a quick location pill", () => {
    render(
      <ScanLauncherDrawer
        isOpen={true}
        onClose={vi.fn()}
        onScanStarted={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/e\.g\. Rajagiriya/i) as HTMLInputElement;
    expect(input.value).toBe("");

    const rajagiriyaPill = screen.getByRole("button", { name: "Rajagiriya" });
    fireEvent.click(rajagiriyaPill);

    expect(input.value).toBe("Rajagiriya");
  });

  it("switches to broad categories tab and toggles category selection", () => {
    render(
      <ScanLauncherDrawer
        isOpen={true}
        onClose={vi.fn()}
        onScanStarted={vi.fn()}
      />
    );

    const categoriesTabBtn = screen.getByRole("button", { name: /broad categories/i });
    fireEvent.click(categoriesTabBtn);

    expect(screen.getByText("For Sale")).toBeInTheDocument();
    expect(screen.getByText("Rentals")).toBeInTheDocument();
  });

  it("submits scoped scan and fires callbacks", async () => {
    const handleScanStarted = vi.fn();
    const handleClose = vi.fn();
    vi.mocked(api.startProspectScan).mockResolvedValueOnce({ job_id: "test-job-123" });

    render(
      <ScanLauncherDrawer
        isOpen={true}
        onClose={handleClose}
        onScanStarted={handleScanStarted}
      />
    );

    const pill = screen.getByRole("button", { name: "Colombo 7" });
    fireEvent.click(pill);

    const submitBtn = screen.getByRole("button", { name: /launch scan/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.startProspectScan).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "ikman",
          keyword: "Colombo 7",
          strict_location: true,
          scan_all: true,
        })
      );
      expect(handleScanStarted).toHaveBeenCalledWith("test-job-123", {
        keyword: "Colombo 7",
        source: "ikman",
        autoFetchPhones: false,
      });
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it("applies a saved scan preset when clicked", () => {
    render(
      <ScanLauncherDrawer
        isOpen={true}
        onClose={vi.fn()}
        onScanStarted={vi.fn()}
      />
    );

    const presetBtn = screen.getByRole("button", { name: "Rajagiriya Lands" });
    fireEvent.click(presetBtn);

    const input = screen.getByPlaceholderText(/e\.g\. Rajagiriya/i) as HTMLInputElement;
    expect(input.value).toBe("Rajagiriya");

    expect(screen.getByText(/Selected: lands/i)).toBeInTheDocument();
  });

  it("calls onClose when cancel or close button is clicked", () => {
    const handleClose = vi.fn();

    render(
      <ScanLauncherDrawer
        isOpen={true}
        onClose={handleClose}
        onScanStarted={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);

    const closeIconBtn = screen.getByRole("button", { name: /close drawer/i });
    fireEvent.click(closeIconBtn);

    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it("saves a new preset using saveScanPreset", async () => {
    const handlePresetsChanged = vi.fn();
    vi.mocked(api.saveScanPreset).mockResolvedValueOnce([
      ...DEFAULT_PRESETS,
      {
        id: "preset-custom-1",
        name: "Dehiwala Beachfront",
        keyword: "Dehiwala",
        property_category: "apartments",
        strict_location: true,
        scan_all: true,
        source: "ikman",
        is_default: false,
      },
    ]);

    render(
      <ScanLauncherDrawer
        isOpen={true}
        onClose={vi.fn()}
        onScanStarted={vi.fn()}
        onPresetsChanged={handlePresetsChanged}
      />
    );

    const dehiwalaPill = screen.getByRole("button", { name: "Dehiwala" });
    fireEvent.click(dehiwalaPill);

    const saveCurrentBtn = screen.getByRole("button", { name: /save current/i });
    fireEvent.click(saveCurrentBtn);

    const nameInput = screen.getByPlaceholderText(/preset name/i);
    fireEvent.change(nameInput, { target: { value: "Dehiwala Beachfront" } });

    const saveBtn = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.saveScanPreset).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Dehiwala Beachfront",
          keyword: "Dehiwala",
          source: "ikman",
        })
      );
      expect(handlePresetsChanged).toHaveBeenCalled();
    });
  });
});

