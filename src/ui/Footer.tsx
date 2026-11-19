import { useEffect, useRef, useState } from "react";

const ATTRIBUTION_URL = `${import.meta.env.BASE_URL}ATTRIBUTION.md`;

/** Credits line plus a dialog showing public/ATTRIBUTION.md. */
export function Footer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || text !== null) return;
    fetch(ATTRIBUTION_URL)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setText)
      .catch((e: unknown) => setText(`Could not load attribution: ${String(e)}`));
  }, [open, text]);

  return (
    <footer className="footer">
      Model: Z-Anatomy (CC BY-SA 4.0), from BodyParts3D © DBCLS (CC BY-SA 2.1 JP) ·{" "}
      <button
        type="button"
        className="link"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        Attribution
      </button>
      <dialog ref={dialog} className="attribution" onClose={() => setOpen(false)} aria-label="Attribution">
        <pre>{text ?? "Loading…"}</pre>
        <p>
          <a href={ATTRIBUTION_URL}>ATTRIBUTION.md</a>
        </p>
        <form method="dialog">
          <button type="submit">Close</button>
        </form>
      </dialog>
    </footer>
  );
}
