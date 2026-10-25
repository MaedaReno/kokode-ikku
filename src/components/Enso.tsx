export function Enso() {
  return (
    <svg className="enso" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <filter id="ink" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" />
        </filter>
      </defs>
      <path
        className="enso-path"
        d="M 150 52 C 120 22, 60 25, 38 70 C 18 112, 45 165, 98 170 C 150 175, 178 130, 168 88 C 163 70, 152 58, 140 50"
        pathLength={1}
        filter="url(#ink)"
      />
    </svg>
  );
}
