// Small dependency-free line chart. Takes [{ label, value }] and renders an
// SVG polyline — enough for a balance-over-time trend without pulling in a
// charting library.
export default function Sparkline({ points, width = 640, height = 160, stroke = 'var(--heloc)' }) {
  if (points.length === 0) return null

  const values = points.map((p) => p.value)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const range = max - min || 1

  const padX = 24
  const padY = 16
  const innerW = width - padX * 2
  const innerH = height - padY * 2

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? padX : padX + (i / (points.length - 1)) * innerW
    const y = padY + innerH - ((p.value - min) / range) * innerH
    return { x, y, ...p }
  })

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const zeroY = padY + innerH - ((0 - min) / range) * innerH

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Balance trend">
      <line x1={padX} y1={zeroY} x2={width - padX} y2={zeroY} stroke="var(--border)" strokeDasharray="4 4" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" />
      {coords.map((c) => (
        <g key={c.label}>
          <circle cx={c.x} cy={c.y} r="3.5" fill={stroke} />
          <text x={c.x} y={height - 2} textAnchor="middle" className="spark-label">
            {c.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
