import { describe, expect, it, vi } from "vitest";

import { SIGN_OUT_PAGE, postSignOut, signOutToFrontPage } from "@/components/sign-out-button";

describe("signOutToFrontPage", () => {
  it("signs out with next-auth's client, back to the front page", async () => {
    const signOut = vi.fn(async () => undefined);
    const fallback = vi.fn(async () => undefined);
    await signOutToFrontPage(async () => ({ signOut }), fallback);
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/" });
    expect(fallback).not.toHaveBeenCalled();
  });

  it("still signs out when the client can't be loaded (a deploy replaced it)", async () => {
    const fallback = vi.fn(async () => undefined);
    await signOutToFrontPage(async () => {
      throw new Error("Loading chunk 123 failed.");
    }, fallback);
    expect(fallback).toHaveBeenCalledOnce();
  });

  it("still signs out when next-auth's client fails", async () => {
    const fallback = vi.fn(async () => undefined);
    const signOut = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await signOutToFrontPage(async () => ({ signOut }), fallback);
    expect(fallback).toHaveBeenCalledOnce();
  });
});

describe("postSignOut", () => {
  it("posts the sign-out form with the CSRF token, back to the front page", async () => {
    const fetcher = vi.fn(async () => Response.json({ csrfToken: "token-1" })) as unknown as typeof fetch;
    const submit = vi.fn();
    const navigate = vi.fn();
    await postSignOut(fetcher, submit, navigate);
    expect(fetcher).toHaveBeenCalledWith("/api/auth/csrf", { credentials: "same-origin" });
    // A POST signs out at once; a GET of this address would stop on next-auth's question.
    expect(submit).toHaveBeenCalledWith(SIGN_OUT_PAGE, { csrfToken: "token-1", callbackUrl: "/" });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("opens next-auth's own sign-out page when the token can't be fetched", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const submit = vi.fn();
    const navigate = vi.fn();
    await postSignOut(fetcher, submit, navigate);
    expect(submit).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(SIGN_OUT_PAGE);
    expect(SIGN_OUT_PAGE).toBe("/api/auth/signout");
  });

  it("opens the sign-out page when the answer has no token", async () => {
    const fetcher = vi.fn(async () => Response.json({})) as unknown as typeof fetch;
    const navigate = vi.fn();
    await postSignOut(fetcher, vi.fn(), navigate);
    expect(navigate).toHaveBeenCalledWith(SIGN_OUT_PAGE);
  });
});
