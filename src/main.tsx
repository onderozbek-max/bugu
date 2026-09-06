import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AdminPanel } from "./admin/AdminPanel";
import { reconcileStageOnBoot } from "./state/journeyStore";
import { checkUnlockLink } from "./state/albumMode";
import "./styles/global.css";

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
}
