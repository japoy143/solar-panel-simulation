// Illustrative top-down roof plan with a panel layout (decorative, not real data).

const PANEL_W = 36;
const PANEL_H = 30;
const GAP = 4;
const CENTER_X = 240;
const rows = [
  { y: 196, count: 6 },
  { y: 232, count: 7 },
  { y: 268, count: 8 },
];

const panels = rows.flatMap(({ y, count }) => {
  const rowWidth = count * PANEL_W + (count - 1) * GAP;
  const startX = CENTER_X - rowWidth / 2;
  return Array.from({ length: count }, (_, i) => ({
    x: startX + i * (PANEL_W + GAP),
    y,
  }));
});

export function HeroVisual() {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-linear-to-b from-primary/10 via-background to-muted/60">
      <svg
        viewBox="0 0 480 360"
        className="h-auto w-full"
        role="img"
        aria-label="Top-down roof plan with a solar panel layout"
      >
        {/* Sun and its path */}
        <path
          d="M 40 120 Q 240 -40 440 120"
          fill="none"
          strokeDasharray="4 6"
          className="stroke-primary"
          strokeWidth="1.5"
        />
        <circle cx="352" cy="58" r="14" className="fill-primary" />

        {/* Hip roof outline */}
        <rect
          x="40"
          y="150"
          width="400"
          height="160"
          rx="4"
          className="fill-background stroke-border"
          strokeWidth="1.5"
        />
        <path
          d="M 40 150 L 150 180 L 330 180 L 440 150 M 40 310 L 150 180 M 440 310 L 330 180"
          fill="none"
          className="stroke-border"
          strokeWidth="1.5"
        />

        {/* Panels */}
        {panels.map((p) => (
          <g key={`${p.x}-${p.y}`}>
            <rect
              x={p.x}
              y={p.y}
              width={PANEL_W}
              height={PANEL_H}
              rx="2"
              className="fill-foreground"
            />
            <path
              d={`M ${p.x + PANEL_W / 2} ${p.y} V ${p.y + PANEL_H} M ${p.x} ${p.y + PANEL_H / 2} H ${p.x + PANEL_W}`}
              className="stroke-background/25"
              strokeWidth="1"
            />
          </g>
        ))}

        {/* Dimension line */}
        <path
          d="M 40 330 H 440 M 40 324 V 336 M 440 324 V 336"
          className="stroke-muted-foreground/60"
          strokeWidth="1"
        />
        <rect x="216" y="322" width="48" height="16" className="fill-background" />
        <text
          x="240"
          y="334"
          textAnchor="middle"
          className="fill-muted-foreground text-[11px]"
        >
          12.4 m
        </text>
      </svg>

      <div className="absolute top-4 left-4 rounded-lg border bg-background/90 px-3 py-2 shadow-sm backdrop-blur">
        <p className="eyebrow text-muted-foreground">Example layout</p>
        <p className="text-sm font-medium">
          {panels.length} panels · {((panels.length * 400) / 1000).toFixed(1)} kWp
        </p>
      </div>
    </div>
  );
}
