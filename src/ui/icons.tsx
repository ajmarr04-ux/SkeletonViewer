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
export const RelatedIcon = svg(
  <>
    <circle cx="12" cy="12" r="3" />
    <circle cx="5" cy="6" r="2" />
    <circle cx="19" cy="6" r="2" />
    <circle cx="12" cy="20" r="2" />
    <path d="M10 10 6.5 7.3M14 10l3.5-2.7M12 15v3" />
  </>,
);
export const RegionIcon = svg(
  <>
    <circle cx="12" cy="12" r="3" />
    <rect x="3" y="3" width="18" height="18" rx="4" strokeDasharray="3 3" />
  </>,
);
/** The body-region picker (M13): a figure with a dashed focus box. */
export const BodyIcon = svg(
  <>
    <circle cx="12" cy="5" r="2" />
    <path d="M12 8v7M8 10h8M12 15l-3 6M12 15l3 6" />
  </>,
);
export const ExplodeIcon = svg(
  <>
    <rect x="9" y="9" width="6" height="6" rx="1" />
    <path d="M7 7 4 4M4 4h3M4 4v3M17 7l3-3M20 4h-3M20 4v3M7 17l-3 3M4 20h3M4 20v-3M17 17l3 3M20 20h-3M20 20v-3" />
  </>,
);
export const SearchIcon = svg(
  <>
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-4.5-4.5" />
  </>,
);
export const LabelsIcon = svg(
  <>
    <path d="M3 5h11l4 4-4 4H3z" />
    <path d="M7 17v3M7 13v1" />
  </>,
);
export const ColourIcon = svg(
  <>
    <circle cx="8" cy="9" r="4" />
    <circle cx="16" cy="9" r="4" />
    <circle cx="12" cy="16" r="4" />
  </>,
);
export const CameraIcon = svg(
  <>
    <path d="M4 7h3l2-3h6l2 3h3v13H4z" />
    <circle cx="12" cy="13" r="4" />
  </>,
);
export const ShareIcon = svg(
  <>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  </>,
);
export const MoreIcon = svg(
  <>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </>,
);
export const LayersIcon = svg(
  <>
    <path d="M12 3 2 8l10 5 10-5-10-5Z" />
    <path d="m2 12.5 10 5 10-5" />
    <path d="m2 17 10 5 10-5" />
  </>,
);
