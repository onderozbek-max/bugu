import { useState } from "react";
import { DunComposition, YarinComposition, SimdiComposition } from "./compositions";
import "./LabStaticApp.css";

/**
 * Gate A — Static visual evaluation laboratory.
 * URL: ?lab=v2-static
 * UI overlay: add &ui=1 (hidden by default — art must stand alone)
 *
 * Keyboard: D / Y / S to switch states.
 */

type Song = "dun" | "yarin" | "simdi";

export function LabStaticApp() {
  const params = new URLSearchParams(window.location.search);
  const showUI = params.get("ui") === "1";
  const initial = (params.get("song") as Song | null) ?? "dun";

  const [song, setSong] = useState<Song>(initial);

  return (
    <div className="static-lab">
      {song === "dun"   && <DunComposition />}
      {song === "yarin" && <YarinComposition />}
      {song === "simdi" && <SimdiComposition />}

      {showUI && (
        <div className="static-lab__controls">
          {(["dun", "yarin", "simdi"] as Song[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`static-lab__btn${song === id ? " static-lab__btn--active" : ""}`}
              onClick={() => setSong(id)}
            >
              {id === "dun" ? "DÜN" : id === "yarin" ? "YARIN" : "ŞİMDİ"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
