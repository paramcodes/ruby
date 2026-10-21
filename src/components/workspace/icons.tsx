// Minimal icon set for the workspace shell. Stroke follows currentColor so
// rows, buttons, and menus all theme through the text color tokens.
type IconProps = {
  className?: string | undefined;
  size?: number | undefined;
};

function svgProps({ className, size = 16 }: IconProps) {
  return {
    "aria-hidden": true as const,
    className,
    fill: "none",
    height: size,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.75,
    viewBox: "0 0 24 24",
    width: size
  };
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function CollapseSidebarIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M11 7l-5 5 5 5" />
      <path d="M18 7l-5 5 5 5" />
    </svg>
  );
}

export function ExpandSidebarIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M13 7l5 5-5 5" />
      <path d="M6 7l5 5-5 5" />
    </svg>
  );
}

export function EllipsisIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="5" cy="12" r="0.5" fill="currentColor" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
      <circle cx="19" cy="12" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}
