import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ConfirmSpend, SpendConfirm, spendPrompt } from "@/components/confirm-spend";

describe("spendPrompt", () => {
  it("asks with the confirm's verb and names the balance after", () => {
    expect(spendPrompt({ cost: 5, remaining: 40, actionLabel: "Remix" })).toEqual({
      text: "Remix for 5 credits? You'll have 35 left.",
      affordable: true,
    });
    expect(spendPrompt({ cost: 1, actionLabel: "Retry" }).text).toBe("Retry for 1 credit?");
  });

  it("asks a question of its own when the verb doesn't read as one", () => {
    const ask = { cost: 5, actionLabel: "Save and continue", question: "Create the album" };
    expect(spendPrompt({ ...ask, remaining: 50 }).text).toBe("Create the album for 5 credits? You'll have 45 left.");
    expect(spendPrompt(ask).text).toBe("Create the album for 5 credits?");
    expect(spendPrompt({ ...ask, remaining: 3 })).toEqual({
      text: "Create the album? It costs 5 credits and you have 3 credits.",
      affordable: false,
    });
  });

  it("keeps the other callers' wording when the balance falls short", () => {
    expect(spendPrompt({ cost: 5, remaining: 1, actionLabel: "Remix" })).toEqual({
      text: "Remix costs 5 credits and you have 1 credit.",
      affordable: false,
    });
  });
});

describe("SpendConfirm", () => {
  const render = (affordable: boolean, working = false) =>
    renderToStaticMarkup(
      createElement(SpendConfirm, {
        groupId: "g",
        promptId: "p",
        prompt: { text: "Remix for 5 credits?", affordable },
        actionLabel: "Remix",
        working,
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );

  it("never disables the button focus moves to: short of credits, it is only marked unavailable", () => {
    const html = render(false);
    const confirm = html.match(/<button[^>]*>Remix<\/button>/)?.[0] ?? "";
    expect(confirm).not.toMatch(/\sdisabled=""/);
    expect(confirm).toContain('aria-disabled="true"');
  });

  it("leaves an affordable spend available", () => {
    const confirm = render(true).match(/<button[^>]*>Remix<\/button>/)?.[0] ?? "";
    expect(confirm).not.toContain("aria-disabled=");
    expect(confirm).not.toMatch(/\sdisabled=""/);
  });

  it("names the group by its question", () => {
    expect(render(true)).toContain('role="group" aria-labelledby="p"');
  });
});

describe("ConfirmSpend trigger, described", () => {
  it("ties the trigger to the line that explains it", () => {
    const html = renderToStaticMarkup(
      createElement(
        ConfirmSpend,
        { cost: 5, remaining: 1, actionLabel: "Remix", onConfirm: () => {}, disabled: true, describedBy: "why" } as Parameters<
          typeof ConfirmSpend
        >[0],
        "Remix",
      ),
    );
    expect(html).toContain('aria-describedby="why"');
  });
});
