import { describe, expect, it } from "vitest";

import { signInErrorMessage } from "@/lib/sign-in-errors";

describe("signInErrorMessage", () => {
  it("returns null when the URL carries no error", () => {
    expect(signInErrorMessage(undefined)).toBeNull();
    expect(signInErrorMessage(null)).toBeNull();
    expect(signInErrorMessage("")).toBeNull();
    expect(signInErrorMessage("   ")).toBeNull();
    expect(signInErrorMessage([])).toBeNull();
  });

  it.each([
    ["CredentialsSignin", /didn't sign you in/],
    ["OAuthSignin", /GitHub sign-in couldn't start/],
    ["OAuthCallback", /GitHub didn't finish/],
    ["OAuthAccountNotLinked", /already belongs to an account/],
    ["EmailSignin", /couldn't send the sign-in link/],
    ["AccessDenied", /isn't allowed to sign in/],
    ["Verification", /expired or was already used/],
    ["Configuration", /isn't set up correctly/],
  ])("gives %s its own message with a next step", (code, title) => {
    const message = signInErrorMessage(code);
    expect(message?.title).toMatch(title);
    expect(message?.body.length).toBeGreaterThan(0);
  });

  it("gives every known code a different message from the default", () => {
    const fallback = signInErrorMessage("Default");
    for (const code of [
      "CredentialsSignin",
      "OAuthSignin",
      "OAuthCallback",
      "OAuthCreateAccount",
      "EmailCreateAccount",
      "Callback",
      "OAuthAccountNotLinked",
      "EmailSignin",
      "SessionRequired",
      "AccessDenied",
      "Verification",
      "Configuration",
    ]) {
      expect(signInErrorMessage(code)).not.toEqual(fallback);
    }
  });

  it("falls back to the default for unknown codes and never echoes them", () => {
    const message = signInErrorMessage("<script>alert(1)</script>");
    expect(message?.title).toBe("Something went wrong while signing you in.");
    expect(JSON.stringify(message)).not.toContain("script");
    expect(signInErrorMessage("toString")?.title).toBe(
      "Something went wrong while signing you in.",
    );
  });

  it("reads the first value of a repeated param and ignores surrounding space", () => {
    expect(signInErrorMessage(["Verification", "OAuthSignin"])?.title).toMatch(/expired/);
    expect(signInErrorMessage(" EmailSignin ")?.title).toMatch(/couldn't send/);
  });

  it("uses plain words, not codes or engineering terms", () => {
    for (const code of ["CredentialsSignin", "Configuration", "Unknown"]) {
      const text = JSON.stringify(signInErrorMessage(code));
      expect(text).not.toMatch(/NextAuth|OAuth|Credentials|env|API|server error/i);
    }
  });
});
