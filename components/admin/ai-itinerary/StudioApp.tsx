'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, FolderOpen, LayoutTemplate, MessagesSquare, Settings2, Sparkles } from 'lucide-react';
import { api, type SettingsPayload } from './api';
import Studio from './Studio';
import Library from './Library';
import Templates from './Templates';
import Usage from './Usage';
import SettingsTab from './SettingsTab';

type TabKey = 'studio' | 'library' | 'templates' | 'usage' | 'settings';
const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'studio', label: 'Studio', icon: MessagesSquare },
  { key: 'library', label: 'Library', icon: FolderOpen },
  { key: 'templates', label: 'Templates', icon: LayoutTemplate },
  { key: 'usage', label: 'Usage', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings2 },
];

interface Ctx {
  settings: SettingsPayload | null;
  reloadSettings: () => Promise<void>;
  setSettings: (s: SettingsPayload) => void;
  openProject: (id: string | null) => void;
  goTab: (tab: TabKey, extra?: Record<string, string | null>) => void;
  projectId: string | null;
}
const StudioCtx = createContext<Ctx | null>(null);
export const useStudio = () => {
  const c = useContext(StudioCtx);
  if (!c) throw new Error('useStudio outside StudioApp');
  return c;
};

export default function StudioApp() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = (TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'studio') as TabKey;
  const projectId = params.get('p');
  const [settings, setSettings] = useState<SettingsPayload | null>(null);

  const reloadSettings = useCallback(async () => {
    try { setSettings(await api<SettingsPayload>('/settings')); } catch { /* shown where used */ }
  }, []);
  useEffect(() => { reloadSettings(); }, [reloadSettings]);

  const goTab = useCallback((t: TabKey, extra: Record<string, string | null> = {}) => {
    const sp = new URLSearchParams(params.toString());
    if (t === 'studio') sp.delete('tab'); else sp.set('tab', t);
    for (const [k, v] of Object.entries(extra)) { if (v == null) sp.delete(k); else sp.set(k, v); }
    const qs = sp.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [params, pathname, router]);

  const openProject = useCallback((id: string | null) => goTab('studio', { p: id }), [goTab]);

  const value = useMemo<Ctx>(() => ({ settings, reloadSettings, setSettings, openProject, goTab, projectId }), [settings, reloadSettings, openProject, goTab, projectId]);

  return (
    <StudioCtx.Provider value={value}>
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-sm">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[17px] font-bold leading-tight text-slate-950">AI Itinerary Studio</h1>
              <p className="hidden text-xs text-slate-500 sm:block">Plan in conversation, publish branded itinerary PDFs.</p>
            </div>
          </div>
          <nav aria-label="Studio sections" className="-mx-1 flex max-w-full overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div role="tablist" className="flex gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5">
              {TABS.map((t) => {
                const active = t.key === tab;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => goTab(t.key)}
                    className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 text-[13px] font-semibold transition ${active ? 'bg-purple-50 text-purple-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                  >
                    <t.icon className="h-3.5 w-3.5" aria-hidden />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        {tab === 'studio' && <Studio />}
        {tab === 'library' && <Library />}
        {tab === 'templates' && <Templates />}
        {tab === 'usage' && <Usage />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </StudioCtx.Provider>
  );
}
