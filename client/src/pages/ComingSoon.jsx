import { useLocation } from 'react-router-dom';

export default function ComingSoon() {
  const { pathname } = useLocation();
  const name = pathname.replace('/', '').replace('-', ' ') || 'This section';

  return (
    <div>
      <h1 style={{ textTransform: 'capitalize' }}>{name}</h1>
      <p style={{ color: 'var(--ink-500)', marginTop: 10 }}>
        This module hasn't been built yet — it's on the roadmap.
      </p>
    </div>
  );
}
