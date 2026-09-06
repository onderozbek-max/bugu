import { useState } from "react";
import { ADMIN_PASSPHRASE_HASH } from "../config/songs";
import { setRemoteAlbumModeFlag, unlockThisDevicePermanently } from "../state/albumMode";
import { sha256Hex } from "./sha256";
import "./AdminPanel.css";

type Step = "locked" | "confirm" | "done";

/**
 * Hidden at /admin — never linked from anywhere in the normal UI, so Buğu
 * has no way to stumble onto it. Not designed to withstand a determined
 * attacker; designed so a passerby glancing at the URL bar or the page
 * source sees nothing resembling a plaintext passphrase (see sha256.ts).
 *
 * One action only: unlock Album Mode, globally if ALBUM_FLAG_ENDPOINT is
 * configured, on this device regardless. Requires an explicit confirm tap
 * before it does anything irreversible-feeling.
 */
export function AdminPanel() {
  const [step, setStep] = useState<Step>("locked");
  const [passphrase, setPassphrase] = useState("");
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [globalFlip, setGlobalFlip] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleUnlock = async () => {
    setError(null);
    const computed = await sha256Hex(passphrase.trim());
    if (computed !== ADMIN_PASSPHRASE_HASH) {
      setError("Yanlış parola.");
      return;
    }
    setHash(computed);
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!hash) return;
    setBusy(true);
    unlockThisDevicePermanently();
    const result = await setRemoteAlbumModeFlag(hash);
    setStatus(result.message);
    setGlobalFlip(result.ok);
    setBusy(false);
    setStep("done");
  };

  return (
    <div className="admin">
      <p className="admin__mark">buğu — yönetim</p>

      {step === "locked" && (
        <form
          className="admin__form"
          onSubmit={(e) => {
            e.preventDefault();
            void handleUnlock();
          }}
        >
          <input
            type="password"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="parola"
            className="admin__input"
          />
          <button type="submit" className="admin__button">
            devam et
          </button>
          {error && <p className="admin__error">{error}</p>}
        </form>
      )}

      {step === "confirm" && (
        <div className="admin__form">
          <p className="admin__prompt">
            Albüm Modu'nu açmak üzeresin. Bu, siteyi kalıcı olarak DÜN / YARIN / ŞİMDİ'nin
            hepsinin serbestçe dinlenebildiği hâline geçirir. Geri alınamaz (yeniden manuel
            olarak kapatmadıkça).
          </p>
          <button type="button" className="admin__button admin__button--primary" onClick={() => void handleConfirm()} disabled={busy}>
            {busy ? "açılıyor…" : "Evet, Albüm Modu'nu Aç"}
          </button>
          <button type="button" className="admin__button admin__button--quiet" onClick={() => setStep("locked")} disabled={busy}>
            vazgeç
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="admin__form">
          <p className="admin__prompt">{status}</p>
          <p className="admin__hint">
            {globalFlip
              ? "Buğu'nun telefonu, siteyi bir sonraki açışında/yenilemesinde otomatik olarak Albüm Modu'na geçecek."
              : "Bu cihaz kalıcı olarak açıldı, ama genel (uzak) bir uç nokta tanımlı olmadığı için bu sadece bu cihazda geçerli. Buğu'nun cihazını da açmak için ona ?unlock= bağlantısını göndermen ya da public/album-mode.json dosyasını güncelleyip yeniden yayınlaman gerekir — README'deki \"Albüm Modu'na geçiş\" bölümüne bak."}
          </p>
        </div>
      )}
    </div>
  );
}
