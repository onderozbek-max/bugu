import { useRef, type PointerEvent } from "react";
import "./ProgressBar.css";

/**
 * Restrained hairline progress indicator. In Journey Mode it is
 * presentational only (seekable=false) — the ritual is meant to be
 * listened through, not scrubbed. Album Mode passes seekable=true to allow
 * full replay/seeking.
 */
export function ProgressBar({
  currentTime,
  duration,
  seekable,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  seekable: boolean;
  onSeek?: (seconds: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const fraction = Number.isFinite(duration) && duration > 0 ? currentTime / duration : 0;
  const pct = Math.max(0, Math.min(1, fraction)) * 100;

  const handlePointer = (e: PointerEvent) => {
    if (!seekable || !onSeek || !trackRef.current || !Number.isFinite(duration)) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    onSeek((x / rect.width) * duration);
  };

  return (
    <div
      className={`progress-bar${seekable ? " progress-bar--seekable" : ""}`}
      onPointerDown={handlePointer}
      onPointerMove={(e) => {
        if (e.buttons === 1) handlePointer(e);
      }}
      role={seekable ? "slider" : "progressbar"}
      aria-valuemin={0}
      aria-valuemax={Number.isFinite(duration) ? duration : undefined}
      aria-valuenow={Number.isFinite(currentTime) ? currentTime : undefined}
      aria-label="ilerleme"
    >
      <div className="progress-bar__track" ref={trackRef}>
        <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
