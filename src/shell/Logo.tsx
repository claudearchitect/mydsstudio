/**
 * Studio logo mark — an eight-spoke starburst in the chrome accent color,
 * echoing the Claude desktop mark. Chrome-only (`--app-*` family via
 * `text-app-accent`); never rendered inside the preview subtree.
 */

const SPOKE_COUNT = 8;
const INNER_R = 4.4;
const OUTER_R = 10.2;

const spokes = Array.from({ length: SPOKE_COUNT }, (_, i) => {
  const angle = (i * 2 * Math.PI) / SPOKE_COUNT + Math.PI / 8;
  return {
    x1: 12 + INNER_R * Math.cos(angle),
    y1: 12 + INNER_R * Math.sin(angle),
    x2: 12 + OUTER_R * Math.cos(angle),
    y2: 12 + OUTER_R * Math.sin(angle),
  };
});

export function StudioLogo({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0 text-app-accent"
    >
      {spokes.map(({ x1, y1, x2, y2 }, i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="currentColor"
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
