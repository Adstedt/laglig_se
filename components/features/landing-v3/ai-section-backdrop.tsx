/**
 * The large knowledge-graph texture behind the entire dark AI chapter. It exists
 * to convey scale — the labeled graph the agent navigates is a small island in a
 * much bigger web. Points are placed on a jittered grid (even spread,
 * deterministic so they never reflow) and EVERY point links to its nearest
 * neighbours (no standalone dots). Faint, but present enough to read as "there's
 * a lot more here". A knockout layer hides the lines beneath each dot so they
 * terminate cleanly.
 */
function buildWeb() {
  let s = 0x9e3779b9
  const r = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
  const W = 1440
  const H = 1860
  const cols = 9
  const rows = 12
  const pts: { x: number; y: number; r: number; a: number }[] = []
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      if (r() > 0.84) continue // ~16% gaps so it's not a rigid grid
      // intensity varies across the grid (a smooth wave → regions that are more
      // or less visible) × a little jitter, so the web isn't flat
      const wave = 0.5 + 0.5 * Math.sin(gx * 0.8 + gy * 0.55 + 0.7)
      const a = Math.max(
        0.18,
        Math.min(1.35, (0.4 + 0.65 * wave) * (0.6 + r() * 0.7))
      )
      pts.push({
        x: +((gx + 0.5 + (r() - 0.5) * 0.95) * (W / cols)).toFixed(1),
        y: +((gy + 0.5 + (r() - 0.5) * 0.95) * (H / rows)).toFixed(1),
        r: +(1.3 + r() * 2).toFixed(2),
        a: +a.toFixed(3),
      })
    }
  }
  const edges: [number, number][] = []
  const seen = new Set<string>()
  for (let i = 0; i < pts.length; i++) {
    const near = pts
      .map((p, j) => ({ j, d: Math.hypot(pts[i]!.x - p.x, pts[i]!.y - p.y) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d)
    const k = 2 + (r() > 0.65 ? 1 : 0)
    for (let n = 0; n < k && n < near.length; n++) {
      const j = near[n]!.j
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      if (!seen.has(key)) {
        seen.add(key)
        edges.push([i, j])
      }
    }
  }
  return { W, H, pts, edges }
}

const WEB = buildWeb()

export function AiSectionBackdrop() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${WEB.W} ${WEB.H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <g stroke="white" strokeWidth="1">
        {WEB.edges.map(([a, b], i) => (
          <line
            key={i}
            x1={WEB.pts[a]!.x}
            y1={WEB.pts[a]!.y}
            x2={WEB.pts[b]!.x}
            y2={WEB.pts[b]!.y}
            strokeOpacity={
              +(0.026 * ((WEB.pts[a]!.a + WEB.pts[b]!.a) / 2)).toFixed(3)
            }
          />
        ))}
      </g>
      {/* knockout — lines terminate cleanly beneath each dot (section bg colour) */}
      <g fill="hsl(var(--foreground))">
        {WEB.pts.map((p, i) => (
          <circle key={`k-${i}`} cx={p.x} cy={p.y} r={p.r + 0.9} />
        ))}
      </g>
      <g fill="white">
        {WEB.pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fillOpacity={+(0.045 * p.a).toFixed(3)}
          />
        ))}
      </g>
    </svg>
  )
}
