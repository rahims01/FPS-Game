import type { ReactNode } from 'react';

/** The UI's icon set: one 24-unit grid, 2px square-capped strokes, drawn to match the condensed type. */
const Svg = ({ children, size = 16, title }: { children: ReactNode; size?: number; title?: string }) => (
  <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="square" strokeLinejoin="miter" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
    {title && <title>{title}</title>}
    {children}
  </svg>
);

export const TrophyIcon = (p: { size?: number }) => (
  <Svg {...p}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M7 6H3v2a4 4 0 0 0 4 4M17 6h4v2a4 4 0 0 1-4 4" />
    <path d="M12 14v4M8 21h8M9 18h6" />
  </Svg>
);

export const GearIcon = (p: { size?: number }) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
  </Svg>
);

export const PauseIcon = (p: { size?: number; title?: string }) => (
  <Svg {...p}>
    <path d="M8 5v14M16 5v14" />
  </Svg>
);

export const LockIcon = (p: { size?: number; title?: string }) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="10" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);

export const StarIcon = (p: { size?: number }) => (
  <Svg {...p}>
    <path d="M12 3l2.6 5.8 6.4.6-4.8 4.3 1.4 6.3L12 16.8 6.4 20l1.4-6.3L3 9.4l6.4-.6z" fill="currentColor" strokeWidth={1} />
  </Svg>
);

/** Headshot marker in the kill feed: a reticle. */
export const HeadshotIcon = (p: { size?: number; title?: string }) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="6" />
    <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
  </Svg>
);

export const FullscreenIcon = (p: { size?: number; title?: string }) => (
  <Svg {...p}>
    <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
  </Svg>
);

export const ExitFullscreenIcon = (p: { size?: number; title?: string }) => (
  <Svg {...p}>
    <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />
  </Svg>
);

export const ArrowIcon = (p: { size?: number }) => (
  <Svg {...p}>
    <path d="M5 12h13M13 6l6 6-6 6" />
  </Svg>
);
