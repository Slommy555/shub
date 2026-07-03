/**
 * Slommy HQ brand mark — an angular "S" monogram on an indigo→violet→cyan
 * gradient squircle with a glowing cyan accent node. Kept in sync with
 * `public/favicon.svg` and the PWA PNG icons.
 */
export default function Logo({
  size = 40,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="Slommy HQ logo"
    >
      <defs>
        <linearGradient id="slommyhq-grad" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4f46e5" />
          <stop offset="0.5" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      {/* gradient squircle + subtle HUD bezel */}
      <rect width="48" height="48" rx="13" fill="url(#slommyhq-grad)" />
      <rect x="1.5" y="1.5" width="45" height="45" rx="11.5" fill="none" stroke="#fff" strokeOpacity="0.18" />
      {/* angular S monogram */}
      <path
        d="M32 15 L19 15 L19 23 L29 23 L29 33 L16 33"
        stroke="#fff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* glowing accent node */}
      <circle cx="16" cy="33" r="2.4" fill="#67e8f9" />
    </svg>
  );
}
