import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deleteFieldAssignment,
  deleteFieldAssignmentByProspect,
  updateFieldAssignment,
  ChatError,
} from "@/lib/api";

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("field assignments API update and deletion", () => {
  it("updates field assignment status and notes", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000");
    const updatedRecord = { id: "asgn-123", status: "contacted", notes: "Called owner directly" };
    const fetchSpy = vi.fn(async () => jsonResponse(200, updatedRecord));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await updateFieldAssignment("asgn-123", {
      status: "contacted",
      notes: "Called owner directly",
    });
    expect(result).toEqual(updatedRecord);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/admin/field-assignments/asgn-123",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({ status: "contacted", notes: "Called owner directly" }),
      })
    );
  });

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
