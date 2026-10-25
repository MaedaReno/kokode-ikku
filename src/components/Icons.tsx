type P = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const CameraIcon = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="6" width="18" height="14" rx="2" />
    <circle cx="12" cy="13" r="3.5" />
    <path d="M8 6l1.5-2h5L16 6" />
  </svg>
);

export const BackIcon = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const CloseIcon = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const ExpandIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);

export const SwapIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M4 12a8 8 0 0 1 14-5.3L20 9" />
    <path d="M20 4v5h-5" />
    <path d="M20 12a8 8 0 0 1-14 5.3L4 15" />
    <path d="M4 20v-5h5" />
  </svg>
);

export const BrushIcon = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M18 3l3 3-11 11-4 1 1-4z" />
    <path d="M4 21c3-1 5-1 8 0" />
  </svg>
);

export const RedoIcon = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7" />
    <path d="M20 4v5h-5" />
  </svg>
);

export const PenIcon = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <path d="M16 3l5 5-12 12H4v-5z" />
    <path d="M13 6l5 5" />
  </svg>
);

export const ToneIcon = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
  </svg>
);

export const SaveIcon = ({ size = 24 }: P) => (
  <svg {...base(size)} strokeWidth={1.8}>
    <path d="M12 3v12" />
    <path d="M7 10l5 5 5-5" />
    <path d="M4 19h16" />
  </svg>
);

export const ImageIcon = ({ size = 28 }: P) => (
  <svg {...base(size)} strokeWidth={1.5}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 16l-5-5-9 9" />
  </svg>
);

export const VideoIcon = ({ size = 28 }: P) => (
  <svg {...base(size)} strokeWidth={1.5}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M10 9l5 3-5 3z" />
  </svg>
);

export const HomeIcon = ({ size = 26 }: P) => (
  <svg {...base(size)}>
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v10h12V10" />
    <path d="M10 20v-5h4v5" />
  </svg>
);

export const GalleryIcon = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="8" height="8" rx="1" />
    <rect x="13" y="3" width="8" height="8" rx="1" />
    <rect x="3" y="13" width="8" height="8" rx="1" />
    <rect x="13" y="13" width="8" height="8" rx="1" />
  </svg>
);

export const BookIcon = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
    <path d="M4 21V5" />
    <path d="M9 7v8" />
  </svg>
);

export const LeafIcon = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z" />
    <path d="M5 19l8-8" />
  </svg>
);

export const SettingsIcon = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
  </svg>
);

export const TrashIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13h10l1-13" />
  </svg>
);

export const ChevronIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export const GlobeIcon = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
  </svg>
);

export const HeartIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </svg>
);
