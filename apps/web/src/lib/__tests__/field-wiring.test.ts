import { createElement as h, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Field, mergeDescribedBy } from "@/components/ui";

function render(node: Parameters<typeof renderToStaticMarkup>[0]) {
  return renderToStaticMarkup(node);
}

describe("Field", () => {
  it("ties the hint to the control without the caller wiring it", () => {
    const html = render(h(Field, { label: "Artist", htmlFor: "artist", hint: "Optional.", children: h("input", { id: "artist" }) }));
    expect(html).toContain('id="artist" aria-describedby="artist-hint"');
    expect(html).toContain('id="artist-hint"');
    expect(html).not.toContain("aria-invalid");
  });

  it("points at the error and marks the control invalid when there is one", () => {
    const html = render(
      h(Field, {
        label: "Title",
        htmlFor: "title",
        hint: "A working title.",
        error: "Give it a title.",
        children: h("input", { id: "title", "aria-describedby": "title-hint" }),
      }),
    );
    expect(html).toContain('aria-describedby="title-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).not.toContain("title-hint");
  });

  it("keeps ids the caller added for other descriptions", () => {
    const html = render(
      h(Field, {
        label: "Key",
        htmlFor: "key",
        hint: "Any key.",
        children: h("select", { id: "key", "aria-describedby": "key-help" }),
      }),
    );
    expect(html).toContain('aria-describedby="key-help key-hint"');
  });

  it("finds the control inside a fragment or a wrapper element", () => {
    const html = render(
      h(Field, {
        label: "Mood",
        htmlFor: "mood",
        hint: "Separate with commas.",
        children: h(Fragment, null, h("div", { className: "row" }, h("input", { id: "mood" }), h("button", null, "Add"))),
      }),
    );
    expect(html).toContain('id="mood" aria-describedby="mood-hint"');
    expect(html).toContain("<button>Add</button>");
  });

  it("hands the props to a render function", () => {
    const html = render(
      h(Field, {
        label: "Note",
        htmlFor: "note",
        error: "Too long.",
        children: (control: { id: string }) => h("textarea", control),
      }),
    );
    expect(html).toContain('<textarea id="note" aria-describedby="note-error" aria-invalid="true">');
  });

  it("adds nothing when there is neither hint nor error", () => {
    const html = render(h(Field, { label: "Name", htmlFor: "name", children: h("input", { id: "name" }) }));
    expect(html).toContain('<input id="name"/>');
  });
});

describe("mergeDescribedBy", () => {
  it("drops the Field's stale ids and de-duplicates", () => {
    expect(mergeDescribedBy("x-hint other other", "x", "x-error")).toBe("other x-error");
    expect(mergeDescribedBy(undefined, "x", null)).toBeUndefined();
  });
});
