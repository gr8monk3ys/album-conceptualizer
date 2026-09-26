import { describe, expect, it, vi } from "vitest";

import { SIGN_OUT_PAGE, signOutToFrontPage } from "@/components/sign-out-button";

describe("signOutToFrontPage", () => {
  it("signs out with next-auth's client, back to the front page", async () => {
    const signOut = vi.fn(async () => undefined);
    const navigate = vi.fn();
    await signOutToFrontPage(async () => ({ signOut }), navigate);
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/" });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("still signs out when the client can't be loaded (offline, or a deploy replaced it)", async () => {
    const navigate = vi.fn();
    await signOutToFrontPage(async () => {
      throw new Error("Loading chunk 123 failed.");
    }, navigate);
    // next-auth's own sign-out page works without this page's scripts.
    expect(navigate).toHaveBeenCalledWith(SIGN_OUT_PAGE);
    expect(SIGN_OUT_PAGE).toBe("/api/auth/signout");
  });

  it("goes to the sign-out page when signing out fails", async () => {
    const navigate = vi.fn();
    const signOut = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await signOutToFrontPage(async () => ({ signOut }), navigate);
    expect(navigate).toHaveBeenCalledWith(SIGN_OUT_PAGE);
  });
});
