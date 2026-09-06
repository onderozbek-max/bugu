import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { prefersReducedMotion } from "../lib/motionPrefs";
import "./LyricsSheet.css";

/**
 * Physical bottom sheet for lyrics. Deliberately NOT synced to playback
 * position — no current-line highlight, no auto-scroll, no karaoke. It
 * opens on request, holds still, and closes on request (swipe down or
 * scrim tap). That's the entire interaction.
 */
export function LyricsSheet({
  open,
  onClose,
  title,
  stanzas,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  stanzas: string[][];
}) {
  const reduced = prefersReducedMotion();

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose();
  };

  // AnimatePresence's documented contract wants direct, individually-keyed
  // children rather than a single Fragment wrapping both — passed as a
  // real array here. (During this pass, the sheet was observed stuck at
  // its initial translateY(100%) in one browser-automation session; that
  // was traced to the tab being backgrounded — document.visibilityState
  // stayed "hidden" for the whole session, which suspends Framer Motion's
  // rAF-driven tween entirely. It was NOT caused by the Fragment shape or
  // by the reduced-motion branch below, both of which were changed during
  // debugging but neither of which reproduced or fixed the stall on their
  // own. Re-verify the actual enter/exit motion on a real, foregrounded
  // device — this fix is kept because it matches AnimatePresence's
  // documented usage, not because it was proven to be the cause.)
  return (
    <AnimatePresence>
      {open && [
        <motion.div
          key="scrim"
          className="lyrics-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.15 : 0.3 }}
          onClick={onClose}
        />,
        <motion.div
          key="sheet"
          className="lyrics-sheet"
          // Always the same animated property (y) in both initial and
          // animate — only the duration shortens under reduced motion,
          // rather than switching to an opacity-only entrance. Kept as the
          // safer shape (never let the animated property set change based
          // on a runtime condition) even though it wasn't confirmed to be
          // the cause of the stall described above.
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: reduced ? 0.18 : 0.35, ease: [0.16, 1, 0.3, 1] }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 600 }}
          dragElastic={{ top: 0, bottom: 0.4 }}
          onDragEnd={handleDragEnd}
        >
          <div className="lyrics-sheet__handle" aria-hidden="true" />
          <div className="lyrics-sheet__title">
            sözler — {title.toLocaleLowerCase("tr")}
          </div>
          <div className="lyrics-sheet__body">
            {stanzas.map((stanza, i) => (
              <div className="lyrics-sheet__stanza" key={i}>
                {stanza.map((line, j) => (
                  <p key={j}>{line}</p>
                ))}
              </div>
            ))}
          </div>
        </motion.div>,
      ]}
    </AnimatePresence>
  );
}
