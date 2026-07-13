'use client';

import { useMemo, useState, useEffect } from 'react';
import { Search, X, Check } from 'lucide-react';
import {
  ADDON_ICON_MAP,
  ADDON_ICON_CATEGORIES,
  ALL_ADDON_ICON_NAMES,
} from '@/lib/addon-icons';

const RECENT_KEY = 'gk_addon_recent_icons';

function loadRecent(): string[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(RECENT_KEY) : null;
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((n) => ADDON_ICON_MAP[n]).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function pushRecent(name: string) {
  try {
    const next = [name, ...loadRecent().filter((n) => n !== name)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/**
 * Searchable icon picker for add-ons: search field, category filter, grid,
 * selected preview, clear option and recently-used row. Emits the icon KEY.
 */
export default function IconPicker({
  value,
  onChange,
  onClose,
}: {
  value?: string | null;
  onChange: (iconKey: string | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let names = category === 'All'
      ? ALL_ADDON_ICON_NAMES
      : ADDON_ICON_CATEGORIES.find((c) => c.name === category)?.icons || [];
    if (q) names = ALL_ADDON_ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
    return names;
  }, [query, category]);

  const pick = (name: string) => {
    pushRecent(name);
    onChange(name);
    onClose();
  };

  const SelectedPreview = value ? ADDON_ICON_MAP[value] : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-purple-200 shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {SelectedPreview ? (
              <span className="w-9 h-9 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
                <SelectedPreview className="w-5 h-5" />
              </span>
            ) : (
              <span className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200" />
            )}
            <div>
              <p className="text-sm font-bold text-gray-900">Choose an icon</p>
              <p className="text-xs text-gray-500">{value || 'No icon selected'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons…"
              className="w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-gray-900 bg-white"
            />
          </div>
        </div>

        {/* Categories */}
        {!query && (
          <div className="px-4 flex gap-1.5 overflow-x-auto pb-2 no-scrollbar">
            {['All', ...ADDON_ICON_CATEGORIES.map((c) => c.name)].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`shrink-0 px-3 h-8 rounded-full text-xs font-medium border transition-colors ${
                  category === c
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Recent */}
        {!query && recent.length > 0 && (
          <div className="px-4 py-1">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Recently used</p>
            <div className="flex gap-1.5">
              {recent.map((name) => {
                const Ico = ADDON_ICON_MAP[name];
                return (
                  <button key={name} type="button" onClick={() => pick(name)}
                    className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300">
                    <Ico className="w-4.5 h-4.5" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="p-4 pt-2 overflow-y-auto grid grid-cols-6 gap-2">
          {results.map((name) => {
            const Ico = ADDON_ICON_MAP[name];
            const selected = value === name;
            return (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => pick(name)}
                className={`aspect-square rounded-lg flex items-center justify-center border transition-colors relative ${
                  selected
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300'
                }`}
              >
                <Ico className="w-5 h-5" />
                {selected && <Check className="w-3 h-3 absolute top-0.5 right-0.5" />}
              </button>
            );
          })}
          {results.length === 0 && (
            <p className="col-span-6 text-center text-sm text-gray-400 py-6">No icons match “{query}”.</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 flex justify-between">
          <button
            type="button"
            onClick={() => { onChange(null); onClose(); }}
            className="px-3 h-9 text-sm text-gray-600 hover:text-red-600 rounded-lg"
          >
            Clear icon
          </button>
          <button type="button" onClick={onClose} className="px-4 h-9 text-sm font-medium text-purple-700 hover:bg-purple-50 rounded-lg">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
