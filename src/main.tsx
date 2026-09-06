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
