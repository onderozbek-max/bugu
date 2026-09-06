/** Shared by Transition.tsx and SongScreen's closing-iris choreography. */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The one easing curve used at every seam in the app — decelerates hard,
 * no bounce. Kept here so every consumer imports the exact same values. */
export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
