function Blossom({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 100 100" fill="currentColor" focusable="false">
    <g transform="translate(50 50)">
      <ellipse cy="-23" rx="13" ry="23" />
      <ellipse cy="-23" rx="13" ry="23" transform="rotate(72)" />
      <ellipse cy="-23" rx="13" ry="23" transform="rotate(144)" />
      <ellipse cy="-23" rx="13" ry="23" transform="rotate(216)" />
      <ellipse cy="-23" rx="13" ry="23" transform="rotate(288)" />
      <circle r="5" fill="#fff7fa" />
    </g>
  </svg>;
}

export function SakuraDecoration() {
  return <div data-testid="sakura-decoration" data-sakura-decoration aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none">
    <Blossom className="sakura-bloom sakura-bloom-one" />
    <Blossom className="sakura-bloom sakura-bloom-two" />
    <Blossom className="sakura-bloom sakura-bloom-three" />
    <span data-sakura-petal /><span data-sakura-petal /><span data-sakura-petal /><span data-sakura-petal />
  </div>;
}
