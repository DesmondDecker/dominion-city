import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { getCurrentUser } from '../lib/session';
import { loadChurchId } from '../lib/church';
import InstallButton from './InstallButton';

const ADMIN_ROLES = ['national_admin', 'territory_admin', 'branch_admin'];

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/territories', label: 'Territories', adminOnly: true },
  { to: '/branches', label: 'Branches' },
  { to: '/members', label: 'Members' },
  { to: '/checkin', label: 'Check-in' },
  { to: '/events', label: 'Events' },
  { to: '/departments', label: 'Departments' },
  { to: '/welfare', label: 'Welfare' },
  { to: '/giving', label: 'Giving' },
  { to: '/pastoral-care', label: 'Pastoral care' },
  { to: '/admin', label: 'Admin', adminOnly: true },
];

export default function Layout() {
  const online = useOnlineStatus();
  const user = getCurrentUser();
  const isAdmin = ADMIN_ROLES.includes(user?.role);
  const visibleNav = NAV.filter((item) => !item.adminOnly || isAdmin);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Eagerly fetch + cache the church ID so every page has it available
  // without the user needing to visit Branches first.
  useEffect(() => {
    loadChurchId().catch(() => {});
  }, []);

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile-only header bar — hidden on desktop via CSS */}
      <div className="mobile-header">
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16 }}>Dominion City</span>
        <button className="menu-toggle" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          ☰
        </button>
      </div>

      {drawerOpen && <div className="sidebar-backdrop open" onClick={() => setDrawerOpen(false)} />}

      <aside
        className={`app-sidebar${drawerOpen ? ' open' : ''}`}
        style={{
          width: 240,
          flexShrink: 0,
          background: 'var(--navy-900)',
          color: '#cfe0f2',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, padding: '0 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              aria-hidden="true"
              style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #cfe0f2', display: 'inline-block' }}
            />
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: '#fff' }}>Dominion City</span>
          </div>
          <button
            className="menu-toggle"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            style={{ display: drawerOpen ? 'inline-flex' : 'none' }}
          >
            ✕
          </button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setDrawerOpen(false)}
              style={({ isActive }) => ({
                padding: '9px 12px',
                borderRadius: 8,
                fontSize: 14,
                textDecoration: 'none',
                color: isActive ? '#fff' : '#a9c0d8',
                background: isActive ? 'var(--blue-600)' : 'transparent',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#a9c0d8', padding: '0 8px' }}>
            <span
              aria-hidden="true"
              style={{ width: 7, height: 7, borderRadius: '50%', background: online ? '#5fc48b' : '#e0a24f', display: 'inline-block' }}
            />
            {online ? 'Online' : 'Offline — saving locally'}
          </div>
          <InstallButton />
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!online && (
          <div
            role="status"
            style={{
              background: 'var(--warn-bg)',
              color: 'var(--warn-text)',
              fontSize: 13,
              padding: '8px 16px',
              borderBottom: '1px solid var(--line)',
            }}
          >
            You're offline. Changes are saved on this device and will sync automatically when you're back online.
          </div>
        )}
        <main className="app-main" style={{ flex: 1, padding: '32px', maxWidth: 1100, width: '100%' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
