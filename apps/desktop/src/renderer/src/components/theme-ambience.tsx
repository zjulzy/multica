export function ThemeAmbience() {
  return <div data-testid="theme-ambience" data-theme-ambience aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none">
    <div data-ambience-theme="graphite-copper"><i className="ambient-glint" /><i className="ambient-glint" /><i className="ambient-glint" /><i className="ambient-glint" /></div>
    <div data-ambience-theme="mist-celadon"><i className="ambient-mist" /><i className="ambient-mist" /><i className="ambient-drop" /><i className="ambient-drop" /></div>
    <div data-ambience-theme="cream-gold"><i className="ambient-sun" /><i className="ambient-sun" /><i className="ambient-sun" /><i className="ambient-sun" /></div>
    <div data-ambience-theme="moon-lavender"><i className="ambient-star" /><i className="ambient-star" /><i className="ambient-star" /><i className="ambient-star" /></div>
    <div data-ambience-theme="deep-ocean"><i className="ambient-bubble" /><i className="ambient-bubble" /><i className="ambient-bubble" /><i className="ambient-current" /><i className="ambient-current" /></div>
  </div>;
}
