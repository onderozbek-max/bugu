import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE, prefersReducedMotion } from "../lib/motionPrefs";

/**
 * Thin, opinionated wrapper: opacity + a whisper of scale, never a slide or
 * a spring. Used at every foreground-chrome seam (Opening -> DÜN chrome,
 * DÜN chrome -> YARIN chrome, YARIN chrome -> ŞİMDİ word). The world behind
 * these never cuts (see PersistentWorld) — this only ever crossfades the
 * UI layer on top of it. Duration is intentionally generous by default
 * (900-1800ms) for that layer; shortened under reduced motion rather than
 * skipped outright, since an instant swap between two absolutely-positioned
 * layers can flash both at once for a frame.
 */
export function FadeTransition({
  children,
  duration = 1.1,
  delay = 0,
}: {
  children: ReactNode;
  duration?: number;
  delay?: number;
}) {
  const reduced = prefersReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1 }}
      animate={{ opacity: 1, scale: 1.0 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{
        duration: reduced ? Math.min(duration, 0.35) : duration,
        delay: reduced ? 0 : delay,
        ease: EASE,
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      {children}
    </motion.div>
  );
}
