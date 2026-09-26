"use client";

import type { ComponentProps } from "react";

/**
 * A select that submits its form as soon as the choice changes, for GET forms that only
 * narrow a list (the page stays the same page, only the list changes). Without JavaScript the
 * form's own submit button does the same job.
 */
export function SubmitOnChangeSelect({ onChange, ...props }: ComponentProps<"select">) {
  return (
    <select
      {...props}
      onChange={(event) => {
        onChange?.(event);
        event.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
