'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, X, ChevronsLeft, ChevronsRight, ExternalLink } from 'lucide-react';
import { ADMIN_NAV, isAdminNavActive, type AdminNavItem } from '@/components/admin/adminNav';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ACCENT = '#7541F5';

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/admin" className="flex items-center gap-2.5 min-w-0 outline-none rounded-lg focus-visible:ring-2 focus-visible:ring-[#7541F5]/40">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white shadow-[0_4px_12px_rgba(117,65,245,0.35)]">
        <MapPin className="h-[18px] w-[18px]" />
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[15px] font-bold tracking-tight text-slate-900">Ghumakkars</div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#7541F5]">Admin Console</div>
        </div>
      )}
    </Link>
  );
}

export default function AdminSidebar({
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [openErrors, setOpenErrors] = useState(0);

  // Badge: unresolved errors in the last 24h. Re-checked on navigation.
  useEffect(() => {
    fetch('/api/admin/error-logs?summary=1', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setOpenErrors(data?.unresolved || 0))
      .catch(() => {});
  }, [pathname]);

  // Close the mobile drawer on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const badgeFor = (item: AdminNavItem) => (item.href === '/admin/error-logs' ? openErrors : 0);

  const renderItem = (item: AdminNavItem, compact: boolean, onClick?: () => void) => {
    const Icon = item.icon;
    const active = isAdminNavActive(pathname, item.href);
    const badge = badgeFor(item);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onClick}
          aria-current={active ? 'page' : undefined}
          aria-label={compact ? item.label : undefined}
          className={`group relative flex items-center rounded-lg text-[13.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#7541F5]/40 ${
            compact ? 'h-10 w-10 mx-auto justify-center' : 'h-9 gap-3 px-3'
          } ${
            active
              ? 'bg-[#F3EEFF] text-[#5B2BD9] font-semibold'
              : 'text-slate-600 font-medium hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          {active && !compact && (
            <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full" style={{ background: ACCENT }} />
          )}
          <Icon
            className={`h-[18px] w-[18px] shrink-0 transition-colors ${
              active ? 'text-[#7541F5]' : 'text-slate-400 group-hover:text-slate-600'
            }`}
            strokeWidth={active ? 2.25 : 2}
          />
          {!compact && <span className="flex-1 truncate">{item.label}</span>}

          {!!badge &&
            (compact ? (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            ) : (
              <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold tabular-nums text-white">
                {badge > 99 ? '99+' : badge}
              </span>
            ))}

          {/* Tooltip when collapsed */}
          {compact && (
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
              {item.label}
              {!!badge && <span className="ml-1.5 text-rose-300">({badge})</span>}
            </span>
          )}
        </Link>
      </li>
    );
  };

  const renderNav = (compact: boolean, onItemClick?: () => void) => (
    // Collapsed: no scroll container, otherwise the hover tooltips get clipped.
    <nav className={`flex-1 py-4 ${compact ? 'px-2 overflow-visible' : 'px-3 overflow-y-auto overflow-x-hidden admin-sidebar-scroll'}`} aria-label="Admin navigation">
      {ADMIN_NAV.map((group, gi) => (
        <div key={group.label} className={gi > 0 ? 'mt-5' : ''}>
          {compact ? (
            gi > 0 && <div className="mx-auto mb-3 h-px w-6 bg-slate-200" />
          ) : (
            <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">{group.items.map((item) => renderItem(item, compact, onItemClick))}</ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* ── Mobile drawer ── */}
      <div
        className={`fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] transition-opacity md:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white transition-[transform,visibility] duration-300 ease-out md:hidden ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full invisible'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex h-14 items-center justify-between border-b border-slate-100 px-4">
          <Brand />
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {renderNav(false, onClose)}
        <div className="border-t border-slate-100 p-3">
          <Link
            href="/"
            target="_blank"
            className="flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <ExternalLink className="h-[18px] w-[18px] text-slate-400" />
            View website
          </Link>
        </div>
      </aside>

      {/* ── Desktop sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-slate-200/80 bg-white transition-[width] duration-200 ease-out md:flex ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className={`flex h-16 shrink-0 items-center border-b border-slate-100 ${isCollapsed ? 'justify-center px-2' : 'px-5'}`}>
          <Brand compact={isCollapsed} />
        </div>

        {renderNav(isCollapsed)}

        <div className={`shrink-0 border-t border-slate-100 ${isCollapsed ? 'px-2 py-3 space-y-1' : 'p-3 space-y-0.5'}`}>
          <Link
            href="/"
            target="_blank"
            title={isCollapsed ? 'View website' : undefined}
            className={`group flex items-center rounded-lg text-[13.5px] font-medium text-slate-600 outline-none transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[#7541F5]/40 ${
              isCollapsed ? 'mx-auto h-10 w-10 justify-center' : 'h-9 gap-3 px-3'
            }`}
          >
            <ExternalLink className="h-[18px] w-[18px] text-slate-400 group-hover:text-slate-600" />
            {!isCollapsed && 'View website'}
          </Link>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`group flex items-center rounded-lg text-[13.5px] font-medium text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[#7541F5]/40 ${
                isCollapsed ? 'mx-auto h-10 w-10 justify-center' : 'h-9 w-full gap-3 px-3'
              }`}
            >
              {isCollapsed ? (
                <ChevronsRight className="h-[18px] w-[18px]" />
              ) : (
                <>
                  <ChevronsLeft className="h-[18px] w-[18px] text-slate-400 group-hover:text-slate-600" />
                  <span className="flex-1 text-left">Collapse</span>
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-semibold text-slate-400">[</kbd>
                </>
              )}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
