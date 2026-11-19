import { useCallback, useEffect, useRef } from "react";
import attributionHtml from "virtual:skeleton-attribution";

const ATTRIBUTION_URL = `${import.meta.env.BASE_URL}ATTRIBUTION.md`;
/** A direct link to the attribution page (plan decision 11). */
export const ATTRIBUTION_HASH = "#attribution";

function setHash(hash: string): void {
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", `${pathname}${search}${hash}`);
}

/**
 * Credits line plus the attribution page: public/ATTRIBUTION.md, compiled to
 * HTML at build time, in a dialog. `#attribution` in the address opens it (so
 * it can be linked to), and closing it clears the hash.
 */
export function Footer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = useCallback(() => {
    const d = dialog.current;
    if (!d || d.open) return;
    d.showModal();
    if (window.location.hash !== ATTRIBUTION_HASH) setHash(ATTRIBUTION_HASH);
  }, []);

  useEffect(() => {
    const check = () => {
      if (window.location.hash === ATTRIBUTION_HASH) open();
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [open]);

  return (
    <footer className="footer">
      Model: Z-Anatomy (CC BY-SA 4.0), from BodyParts3D © DBCLS (CC BY-SA 2.1 JP) ·{" "}
      <a
        href={ATTRIBUTION_HASH}
        className="link"
        data-testid="attribution-link"
        onClick={(e) => {
          e.preventDefault();
          open();
        }}
      >
        Attribution
      </a>
      <dialog
        ref={dialog}
        className="attribution"
        aria-labelledby="attribution-title"
        data-testid="attribution"
        onClose={() => {
          if (window.location.hash === ATTRIBUTION_HASH) setHash("");
        }}
      >
        <div className="attribution-head">
          <h1 id="attribution-title">Attribution</h1>
          <form method="dialog">
            <button type="submit" className="icon-button" aria-label="Close">
              ×
            </button>
          </form>
        </div>
        {/* Trusted HTML: the committed ATTRIBUTION.md, compiled at build time. */}
        <div className="attribution-body" dangerouslySetInnerHTML={{ __html: attributionHtml }} />
        <p className="muted">
          Plain text: <a href={ATTRIBUTION_URL}>ATTRIBUTION.md</a>
        </p>
      </dialog>
    </footer>
  );
}
