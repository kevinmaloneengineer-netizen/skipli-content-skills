// Stroke icons (24×24). Size/colour come from CSS (.btn svg, .nav svg).
function Icon({ children, ...props }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const PenIcon = () => (
  <Icon>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
    <path d="M13.5 7.5l3 3" />
  </Icon>
);
export const CopyIcon = () => (
  <Icon>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </Icon>
);
export const SaveIcon = () => (
  <Icon>
    <path d="M6 3h12v18l-6-4-6 4z" />
  </Icon>
);
export const RetryIcon = () => (
  <Icon>
    <path d="M4 4v6h6" />
    <path d="M20 12a8 8 0 0 0-14.9-4L4 10" />
    <path d="M4 12a8 8 0 0 0 14.9 4" />
  </Icon>
);
