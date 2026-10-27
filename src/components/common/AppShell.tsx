import { Waves } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/explore/orientation', label: 'Explorer', match: '/explore' },
  { to: '/research', label: 'Research', match: '/research' },
  { to: '/replay', label: 'Replay', match: '/replay' },
  { to: '/method', label: 'Method', match: '/method' },
];

/**
 * Page frame: skip link, header, main landmark and the standing disclaimer. `minimal` hides the
 * navigation, for study sessions where participants should not leave the task by accident.
 */
export const AppShell = ({ children, mode, wide = false, minimal = false }: { children: ReactNode; mode?: string; wide?: boolean; minimal?: boolean }) => {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-o-bg text-o-text">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="border-b border-o-line bg-o-s1/95">
        <div className={cn('mx-auto flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6', wide ? 'max-w-[1680px]' : 'max-w-6xl')}>
          {minimal ? (
            <span className="flex items-center gap-2.5 text-sm font-semibold tracking-[0.22em] text-o-text">
              <Waves aria-hidden="true" className="h-5 w-5 text-o-teal" />
              ORPHEUS
            </span>
          ) : (
            <NavLink to="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-[0.22em] text-o-text">
              <Waves aria-hidden="true" className="h-5 w-5 text-o-teal" />
              ORPHEUS
            </NavLink>
          )}
          {mode && <span className="o-chip border-o-teal/50 text-o-teal-strong">{mode}</span>}
          {!minimal && (
            <nav aria-label="Main" className="ml-auto">
              <ul className="flex flex-wrap gap-1">
                {NAV.map((item) => {
                  const active = pathname.startsWith(item.match);
                  return (
                    <li key={item.to}>
                      <NavLink to={item.to} aria-current={active ? 'page' : undefined} className={cn('o-button-quiet min-h-10 px-3', active && 'text-o-teal-strong')}>
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </div>
      </header>
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <footer className="border-t border-o-line">
        <div className={cn('mx-auto px-4 py-6 text-xs leading-relaxed text-o-text3 sm:px-6', wide ? 'max-w-[1680px]' : 'max-w-6xl')}>
          Orpheus is a Vers3Dynamics research simulator. All scenarios, reports and vital signs are fictional or generated. It does not control real systems, measure people, or
          give operational advice. It is not affiliated with, endorsed by, or funded by DARPA or any government agency.
        </div>
      </footer>
    </div>
  );
};
