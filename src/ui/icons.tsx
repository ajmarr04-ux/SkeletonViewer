// Small inline SVG icons for the toolbar (no icon font or extra download).
type P = { title?: string };
const svg = (path: React.ReactNode) =>
  function Icon(_: P) {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {path}
      </svg>
    );
  };

export const HomeIcon = svg(
  <>
    <path d="M3 11 12 4l9 7" />
    <path d="M5 10v10h5v-6h4v6h5V10" />
  </>,
);
export const ViewsIcon = svg(
  <>
    <path d="M12 3 3 8l9 5 9-5-9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </>,
);
export const SettingsIcon = svg(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
  </>,
);
export const GhostIcon = svg(
  <>
    <path d="M6 20V10a6 6 0 0 1 12 0v10l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5Z" />
    <circle cx="10" cy="10" r="1" />
    <circle cx="14" cy="10" r="1" />
  </>,
);
export const OpacityIcon = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v18" />
    <path d="M12 7h5M12 11h8M12 15h7M12 19h3" />
  </>,
);
