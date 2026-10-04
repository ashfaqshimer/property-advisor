import { afterEach, describe, expect, it, vi } from "vitest";

import { triggerAutomatedScanner } from "@/lib/api";

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Scanner Automation API", () => {
  it("triggerAutomatedScanner sends a POST request to the scanner run endpoint", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000");
    const fetchSpy = vi.fn(async () => jsonResponse(200, { message: "Scanner started in background." }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await triggerAutomatedScanner("default-lpw");
    expect(result).toEqual({ message: "Scanner started in background." });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/admin/site-configuration/scanners/default-lpw/run",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
  });

  it("triggerAutomatedScanner properly URI encodes scanner IDs with special characters", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000");
    const fetchSpy = vi.fn(async () => jsonResponse(200, { message: "Scanner started in background." }));
    vi.stubGlobal("fetch", fetchSpy);

    await triggerAutomatedScanner("scanner-colombo luxury");
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/admin/site-configuration/scanners/scanner-colombo%20luxury/run",
      expect.anything(),
    );
  });
});
