import { motion } from "framer-motion";
import { useJourneyStore } from "../state/journeyStore";
import { EASE, prefersReducedMotion } from "../lib/motionPrefs";
import "./Opening.css";

/**
 * The only screen that never explains itself. No mention of an album, a
 * song count, or what "başla" leads to.
 *
 * Its background is not its own — PersistentWorld is already mounted
 * behind it (in its quiet "opening" phase, a low-density echo of DÜN's
 * world), so this component only ever renders foreground text over a
 * transparent container. Tapping "başla" doesn't load a new background;
 * the world just begins transforming toward DÜN's fuller target.
 *
 * BUĞU means mist/fog/breath-on-glass — so its entrance is a literal
 * clearing (blur → focus), not a generic opacity fade. The blur is
 * animated on a wrapper, not the heading itself, so animating `filter`
 * doesn't interact with the heading's own letter-spacing metrics on
 * Safari. Under reduced motion, skips the blur (a still, already-sharp
 * fade-in is not a lesser version of this, just a calmer one).
 */
export function Opening() {
  const begin = useJourneyStore((s) => s.begin);
  const reduced = prefersReducedMotion();

  return (
    <div className="opening">
      <div className="chrome-scrim-bottom" aria-hidden="true" />

      <motion.div
        className="opening__mark-wrap"
        initial={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(18px)" }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: reduced ? 0.8 : 2.1, ease: EASE }}
      >
        <h1 className="opening__mark">BUĞU</h1>
      </motion.div>

      <motion.p
        className="opening__sub"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduced ? 0.6 : 1.3, delay: reduced ? 0.5 : 2.5, ease: EASE }}
      >
        senin için.
      </motion.p>

      <motion.div
        className="opening__begin"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduced ? 0.6 : 1.3, delay: reduced ? 0.9 : 3.9, ease: EASE }}
      >
        <button type="button" onClick={begin}>
          başla
        </button>
      </motion.div>
    </div>
  );
}
