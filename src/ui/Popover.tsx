import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type Props = {
  label: string;
  icon: ReactNode;
  /** "menu" for a list of actions, "dialog" for a settings panel. */
  kind: "menu" | "dialog";
  children: (close: () => void) => ReactNode;
};

/**
 * A toolbar button that opens a panel above it. Escape or a click outside
 * closes it and returns focus to the button. A menu's items take arrow keys.
 */
export function Popover({ label, icon, kind, children }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    // Focus the first item (menu) or the checked/first control (dialog).
    const first = panel.current?.querySelector<HTMLElement>(
      kind === "menu" ? "[role=menuitem]" : "input:checked, input, button",
    );
    first?.focus();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) close(false);
    };
    document.addEventListener("pointerdown", onDown, { capture: true });
    return () => document.removeEventListener("pointerdown", onDown, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (kind !== "menu" || !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const items = [...(panel.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const n = items.length;
    const next = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
    e.preventDefault();
    items[next]?.focus();
  };

  return (
    <div className="popover-anchor">
      <button
        ref={button}
        type="button"
        className="tool"
        aria-label={label}
        title={label}
        aria-haspopup={kind === "menu" ? "menu" : "dialog"}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {icon}
        <span className="tool-label">{label}</span>
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          className={`popover popover-${kind}`}
          role={kind}
          aria-label={label}
          onKeyDown={onKeyDown}
        >
          {children(() => close())}
        </div>
      )}
    </div>
  );
}
