'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Map', icon: '🗺' },
  { href: '/streets', label: 'Streets', icon: '🛣' },
  { href: '/shops', label: 'Shops', icon: '🏪' },
  { href: '/commission', label: 'Commission', icon: '🧮' },
];

export default function Shell({ children }) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          Street Map
          <span>Marketing Planner</span>
        </div>
        <nav>
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${active ? ' active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
