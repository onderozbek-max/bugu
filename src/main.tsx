import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AdminPanel } from "./admin/AdminPanel";
import { reconcileStageOnBoot } from "./state/journeyStore";
import { checkUnlockLink } from "./state/albumMode";
import "./styles/global.css";
// ==================== TEMPORARY — mobile black-screen debug harness ====================
// Delete this whole block (imports, applyDebugFlagsFromUrl/installGlobalErrorCapture
// calls, and the overlay-mounting block below) once the mobile rendering bug is
// fixed. See src/debug/mobileDebug.ts for what each URL flag does.
import "./debug/mobileDebugOverrides.css";
import { applyDebugFlagsFromUrl, installGlobalErrorCapture, isMobileDebugEnabled } from "./debug/mobileDebug";

applyDebugFlagsFromUrl();
installGlobalErrorCapture();
// ==================== end temporary block ====================

// /admin is never linked from anywhere in the normal UI — a plain pathname
// check here is all the "routing" this needs, rather than pulling in a
// router dependency for one hidden page. Checked first and returned early:
// none of the Journey/Album Mode boot logic below is relevant to it.
if (window.location.pathname === "/admin") {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AdminPanel />
    </StrictMode>
  );
} else if (new URLSearchParams(window.location.search).get("lab") === "v3-album") {
  // V3 Album Mode — listen to any song, read lyrics, replay the journey.
  // Unlocks after completing the full Journey. DO NOT MODIFY PRODUCTION.
  import("./lab/v3album/V3AlbumApp").then(({ V3AlbumApp }) => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode><V3AlbumApp /></StrictMode>
    );
  });
} else if (new URLSearchParams(window.location.search).get("lab") === "v3-journey") {
  // V3 Journey — full three-song experience. Opening screen → DÜN → YARIN → ŞİMDİ.
  // One tap starts everything. No player. No UI. DO NOT MIGRATE.
  import("./lab/v3journey/V3JourneyApp").then(({ V3JourneyApp }) => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode><V3JourneyApp /></StrictMode>
    );
  });
} else if (new URLSearchParams(window.location.search).get("lab") === "v3-simdi") {
  // V3 ŞİMDİ — ∞ → Heart morph. Full 3:33. Heart revealed at 2:21.
  // DO NOT MIGRATE. ?demo=1 / ?t=N / ?ui=1
  import("./lab/v3simdi/V3SimdiRenderer").then(({ V3SimdiRenderer }) => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode><V3SimdiRenderer /></StrictMode>
    );
  });
} else if (new URLSearchParams(window.location.search).get("lab") === "v3-yarin") {
  // V3 YARIN — Key → ∞ morph. Full 3:52.
  // ?demo=1 for internal clock. ?t=N for frozen screenshots. DO NOT MIGRATE.
  import("./lab/v3yarin/V3YarinRenderer").then(({ V3YarinRenderer }) => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode><V3YarinRenderer /></StrictMode>
    );
  });
} else if (new URLSearchParams(window.location.search).get("lab") === "v3-dun") {
  // V3 DÜN authored score — Checkpoint 1 (0:00–1:35). Key form construction.
  // ?demo=1 for internal clock / screen recording.
  // ?t=N for frozen screenshots. DO NOT MIGRATE.
  import("./lab/v3dun/V3DunRenderer").then(({ V3DunRenderer }) => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <V3DunRenderer />
      </StrictMode>
    );
  });
} else if (new URLSearchParams(window.location.search).get("lab") === "v3-forms") {
  // V3 destination geometry review — B / Key / Heart from shared DNA. DO NOT MIGRATE.
  import("./lab/v3forms/FormsLab").then(({ FormsLab }) => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode><FormsLab /></StrictMode>
    );
  });
} else if (new URLSearchParams(window.location.search).get("lab") === "v2-score") {
  // DÜN authored score — Checkpoint 1 (0:00–1:35).
  // ?demo=1 for internal clock / screen recording.
  // ?t=N for frozen screenshots. DO NOT MIGRATE.
  import("./lab/v2score/DunScoreRenderer").then(({ DunScoreRenderer }) => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <DunScoreRenderer />
      </StrictMode>
    );
  });
} else if (new URLSearchParams(window.location.search).get("lab") === "v2-dun") {
  // Gate B0 — DÜN 0:00–0:48 authored motion prototype.
  // Completely isolated from production. DO NOT MIGRATE.
  import("./lab/v2dun/DunSequence").then(({ DunSequence }) => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <DunSequence />
      </StrictMode>
    );
  });
} else if (new URLSearchParams(window.location.search).get("lab") === "v2-static") {
  import("./lab/v2static/LabStaticApp").then(({ LabStaticApp }) => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <LabStaticApp />
      </StrictMode>
    );
  });
} else if (new URLSearchParams(window.location.search).get("lab") === "1") {
  // V2 Audiovisual Laboratory — completely isolated from the production journey.
  // Lazy-imported so it adds ZERO bytes to the main production bundle.
  import("./lab/LabApp").then(({ LabApp }) => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <LabApp />
      </StrictMode>
    );
  });
} else {
  // Must run before the first render, not inside a useEffect — otherwise the
  // stale persisted screen mounts for one frame and AnimatePresence plays a
  // pointless exit transition on every resume.
  reconcileStageOnBoot();

  // Also before first render: if this load carries ?unlock=<passphrase>, it
  // must take effect immediately (not a moment after Journey Mode flashes).
  checkUnlockLink();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );

  // TEMPORARY — mobile black-screen debug harness. Mounted as a SEPARATE
  // React root, appended as a SIBLING of #root (not inside it), specifically
  // so it survives whatever is making #root's contents/compositing
  // disappear. Only mounts when ?mobileDebug=1 is present. Delete this
  // block once the mobile rendering bug is fixed.
  if (isMobileDebugEnabled()) {
    const overlayHost = document.createElement("div");
    overlayHost.id = "mobile-debug-overlay-root";
    document.body.appendChild(overlayHost);
    import("./debug/MobileDebugOverlay").then(({ MobileDebugOverlay }) => {
      createRoot(overlayHost).render(<MobileDebugOverlay />);
    });
  }
}
