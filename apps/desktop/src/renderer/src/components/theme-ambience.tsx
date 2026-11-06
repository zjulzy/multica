function Daisy({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    {Array.from({ length: 12 }, (_, i) => <ellipse key={i} cx="0" cy="-16" rx="4.2" ry="11" transform={`rotate(${i * 30})`} fill="#fffef8" stroke="#d5ddc8" strokeWidth=".8" />)}
    <circle r="7" fill="#e5bd60" /><circle r="4.5" fill="#d7a841" />
  </g>;
}

function GardenArt() {
  return <svg className="nature-art nature-garden-art" viewBox="0 0 240 230" fill="none" aria-hidden="true">
    <path d="M183 228C175 183 171 132 146 70M198 228c-2-49-6-90-20-123M166 228c-15-44-26-70-50-98" stroke="#91ad7c" strokeWidth="2" />
    <path d="M174 172c-34-3-42-21-44-34 23 3 41 14 44 34ZM179 193c4-30 18-41 34-42-2 22-13 36-34 42ZM157 190c-24-4-34-16-37-31 21 3 32 12 37 31Z" fill="#a9c19a" />
    <Daisy x={145} y={63} scale={1.15} /><Daisy x={180} y={99} scale={.8} /><Daisy x={113} y={125} scale={.66} />
    <circle cx="202" cy="65" r="2" fill="#d8b567" /><circle cx="93" cy="84" r="1.5" fill="#a7c397" />
  </svg>;
}

function HydrangeaArt() {
  const florets = [[110,85],[132,75],[153,79],[172,92],[100,105],[122,105],[145,101],[166,111],[183,112],[109,126],[132,129],[156,128],[175,134],[128,149],[151,150]];
  return <svg className="nature-art nature-hydrangea-art" viewBox="0 0 240 230" fill="none" aria-hidden="true">
    <path d="M146 226c0-26 0-45 3-70M145 201c-20-25-38-30-58-26 8 18 26 28 58 26ZM148 204c18-29 37-36 57-33-9 22-27 32-57 33Z" fill="#a8c5bd" stroke="#9ab8b0" strokeWidth="1.5" />
    {florets.map(([x,y],i) => <g key={i} transform={`translate(${x} ${y}) rotate(${i * 17})`} fill={i % 3 === 0 ? "#b7bbde" : i % 3 === 1 ? "#abc7e4" : "#cad2ed"} stroke="#f7fbff" strokeWidth="1">
      <ellipse cy="-6" rx="5.2" ry="7" /><ellipse cy="6" rx="5.2" ry="7" /><ellipse cx="-6" rx="7" ry="5.2" /><ellipse cx="6" rx="7" ry="5.2" /><circle r="2" fill="#fff8dc" stroke="none" />
    </g>)}
  </svg>;
}

function OsmanthusArt() {
  const flowers = [[128,82],[143,72],[152,90],[166,70],[178,86],[190,76],[134,108],[155,111],[176,108],[197,102],[161,129],[181,132]];
  return <svg className="nature-art nature-osmanthus-art" viewBox="0 0 240 230" fill="none" aria-hidden="true">
    <path d="M231 45c-31 28-53 48-69 75-14 24-26 50-38 92M200 75c-22 3-45 1-61-9M181 97c-28 1-41-3-57-13M166 124c-19-3-29-12-36-20" stroke="#ad8d64" strokeWidth="2" strokeLinecap="round" />
    <path d="M187 91c-9-23-3-35 9-44 7 17 3 32-9 44ZM165 118c-25-4-36-15-38-29 20 0 32 11 38 29ZM210 72c-3-19 5-29 18-33 3 16-3 27-18 33ZM148 146c-21-6-30-18-30-31 18 4 28 14 30 31Z" fill="#a5b28c" />
    {flowers.map(([x,y],i) => <g key={i} transform={`translate(${x} ${y}) rotate(${i * 21})`} fill={i % 2 ? "#edc675" : "#ddb05a"}>
      <ellipse cy="-3" rx="2.4" ry="4" /><ellipse cy="3" rx="2.4" ry="4" /><ellipse cx="-3" rx="4" ry="2.4" /><ellipse cx="3" rx="4" ry="2.4" /><circle r="1.2" fill="#fff4cb" />
    </g>)}
  </svg>;
}

function StarlitArt() {
  return <svg className="nature-art nature-starlit-art" viewBox="0 0 240 230" fill="none" aria-hidden="true">
    <circle cx="157" cy="91" r="62" stroke="#98aeea" strokeWidth=".7" opacity=".3" />
    <circle cx="157" cy="91" r="48" stroke="#aebdf0" strokeWidth=".7" strokeDasharray="2 7" opacity=".45" />
    <path d="M166 48a42 42 0 1 0 33 68 38 38 0 0 1-33-68Z" fill="#e7dcba" opacity=".9" />
    <path d="M46 101 72 80 101 101 124 72 144 81M49 157 76 137 106 148" stroke="#aebff5" strokeWidth="1" opacity=".55" />
    {[[46,101],[72,80],[101,101],[124,72],[144,81],[49,157],[76,137],[106,148]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.4 : 1.6} fill="#f5e9ce" />)}
    <path d="m72 39 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6ZM205 155l1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5 5-1.5 1.5-5Z" fill="#cfdbff" />
    <circle cx="186" cy="31" r="1.4" fill="#e8dcbf" /><circle cx="92" cy="182" r="1.4" fill="#cbd8ff" />
  </svg>;
}

export function ThemeAmbience() {
  return <div data-testid="theme-ambience" data-theme-ambience aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none">
    <div data-ambience-theme="graphite-copper"><i className="ambient-glint" /><i className="ambient-glint" /><i className="ambient-glint" /><i className="ambient-glint" /></div>
    <div data-ambience-theme="mist-celadon"><i className="ambient-mist" /><i className="ambient-mist" /><i className="ambient-drop" /><i className="ambient-drop" /></div>
    <div data-ambience-theme="cream-gold"><i className="ambient-sun" /><i className="ambient-sun" /><i className="ambient-sun" /><i className="ambient-sun" /></div>
    <div data-ambience-theme="moon-lavender"><i className="ambient-star" /><i className="ambient-star" /><i className="ambient-star" /><i className="ambient-star" /></div>
    <div data-ambience-theme="deep-ocean"><i className="ambient-bubble" /><i className="ambient-bubble" /><i className="ambient-bubble" /><i className="ambient-current" /><i className="ambient-current" /></div>
    <div data-nature-theme="daisy-garden"><GardenArt /><div className="nature-echo"><GardenArt /></div><i data-nature-particle /><i data-nature-particle /><i data-nature-particle /><i data-nature-particle /></div>
    <div data-nature-theme="hydrangea-rain"><HydrangeaArt /><div className="nature-echo"><HydrangeaArt /></div><i data-nature-particle /><i data-nature-particle /><i data-nature-particle /><i data-nature-particle /></div>
    <div data-nature-theme="osmanthus-courtyard"><OsmanthusArt /><div className="nature-echo"><OsmanthusArt /></div><i data-nature-particle /><i data-nature-particle /><i data-nature-particle /><i data-nature-particle /></div>
    <div data-nature-theme="starlit-dream"><StarlitArt /><div className="nature-echo"><StarlitArt /></div><i data-nature-particle /><i data-nature-particle /><i data-nature-particle /><i data-nature-particle /></div>
  </div>;
}
