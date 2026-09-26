/** Whether the viewer asked the system for less motion (false on the server). */
export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Smooth scrolling, unless the viewer asked the system for less motion. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}
