import { AnimatePresence, motion } from "framer-motion";
import { prefersReducedMotion } from "../lib/motionPrefs";
import "./LyricsSheet.css";

/**
 * Not a sheet. Tapping "sözler" doesn't cover the world with a new surface —
 * it resolves a calm region of the same visual field (a soft-edged clearing,
 * not a rectangle, not a hard boundary, no full-background blur) and lets
 * the words become visible inside it. The rest of the field stays present
 * and visible, just quieter, so this reads as looking further into the same
 * scene rather than opening a modal on top of it.
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="lyrics-veil"
          className="lyrics-veil"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.15 : 0.5 }}
          onClick={onClose}
        >
          <motion.div
            className="lyrics-clearing"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.82, opacity: 0 }}
            transition={{ duration: reduced ? 0.18 : 0.65, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lyrics-clearing__pool" aria-hidden="true" />
            <div className="lyrics-clearing__scroll">
              <div className="lyrics-clearing__title">sözler — {title.toLocaleLowerCase("tr")}</div>
              {stanzas.map((stanza, i) => (
                <div className="lyrics-clearing__stanza" key={i}>
                  {stanza.map((line, j) => (
                    <p key={j}>{line}</p>
                  ))}
                </div>
              ))}
            </div>
            <button type="button" className="lyrics-clearing__close" onClick={onClose} aria-label="kapat">
              geri
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
