export default function MiniBarChart({ data, labelKey, valueKey, height = 100, formatLabel }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  const defaultFormat = (v) => new Date(v).toLocaleDateString('default', { weekday: 'narrow' });
  const format = formatLabel || defaultFormat;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height }}>
      {data.map((d, i) => {
        const isLast = i === data.length - 1;
        const barHeight = Math.max(4, (d[valueKey] / max) * (height - 20));
        return (
          <div key={d[labelKey]} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                width: '100%',
                height: barHeight,
                background: isLast ? 'var(--blue-600)' : 'var(--blue-100)',
                borderRadius: '4px 4px 0 0',
              }}
              title={`${d[labelKey]}: ${d[valueKey]}`}
            />
            <span style={{ fontSize: 10, color: 'var(--ink-500)' }}>{format(d[labelKey])}</span>
          </div>
        );
      })}
    </div>
  );
}
