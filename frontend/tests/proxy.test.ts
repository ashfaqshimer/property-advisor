import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, proxy } from "../proxy";

describe("Admin Route Proxy (Auth Guard)", () => {
  it("redirects unauthenticated requests from /admin to /login", () => {
    const req = new NextRequest("http://localhost:3000/admin");
    const res = proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("redirects unauthenticated requests from /admin/properties to /login", () => {
    const req = new NextRequest("http://localhost:3000/admin/properties");
    const res = proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("allows authenticated requests to /admin when session cookie is present", () => {
    const req = new NextRequest("http://localhost:3000/admin", {
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=test-session-token`,
      },
    });
    const res = proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects authenticated users on /login to /admin", () => {
    const req = new NextRequest("http://localhost:3000/login", {
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=test-session-token`,
      },
    });
    const res = proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/admin");
  });

  it("allows unauthenticated visitors on /login", () => {
    const req = new NextRequest("http://localhost:3000/login");
    const res = proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
