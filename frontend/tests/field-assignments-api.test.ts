import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deleteFieldAssignment,
  deleteFieldAssignmentByProspect,
  ChatError,
} from "@/lib/api";

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("field assignments API deletion", () => {
  it("deletes field assignment by ID", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000");
    const fetchSpy = vi.fn(async () => jsonResponse(200, { ok: true, id: "asgn-123" }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await deleteFieldAssignment("asgn-123");
    expect(result).toEqual({ ok: true, id: "asgn-123" });
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/admin/field-assignments/asgn-123",
      expect.objectContaining({
        method: "DELETE",
        credentials: "include",
      })
    );
  });

  it("deletes field assignment by prospect ID", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000");
    const fetchSpy = vi.fn(async () => jsonResponse(200, { ok: true, id: "asgn-456" }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await deleteFieldAssignmentByProspect("prospect-456");
    expect(result).toEqual({ ok: true, id: "asgn-456" });
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/admin/field-assignments/by-prospect/prospect-456",
      expect.objectContaining({
        method: "DELETE",
        credentials: "include",
      })
    );
  });

  it("throws ChatError on deletion failure", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000");
    const fetchSpy = vi.fn(async () => jsonResponse(404, { detail: "Assignment not found." }));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(deleteFieldAssignment("invalid-id")).rejects.toThrow("Assignment not found.");
  });
});
