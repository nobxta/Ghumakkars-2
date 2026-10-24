'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookUser, Building2, Bus, Car, Check, Compass, Contact, Copy, ExternalLink, Handshake, Heart, MapPin,
  MessageCircle, Pencil, Phone, Plus, Search, Siren, Star, StickyNote, Store, Trash2, UserCheck, X,
} from 'lucide-react';
import { CONTACT_CATEGORIES, phoneDigits, type AdminContact, type ContactCategory } from '@/lib/admin-contacts';

export interface TripOption { id: string; title: string; destination?: string | null }
export type ContactDraft = Omit<AdminContact, 'id' | 'created_at' | 'updated_at'>;

const CATEGORY: Record<ContactCategory, { label: string; plural: string; icon: typeof Contact; color: string; bg: string }> = {
  hotel: { label: 'Hotel', plural: 'Hotels', icon: Building2, color: '#0369A1', bg: '#E0F2FE' },
  transport: { label: 'Transport', plural: 'Transport', icon: Bus, color: '#C2410C', bg: '#FFF1E7' },
  driver: { label: 'Driver', plural: 'Drivers', icon: Car, color: '#B45309', bg: '#FFF7E6' },
  guide: { label: 'Guide', plural: 'Guides', icon: Compass, color: '#047857', bg: '#ECFDF5' },
  captain: { label: 'Trip captain', plural: 'Trip captains', icon: UserCheck, color: '#7C4DEB', bg: '#F1EBFF' },
  food: { label: 'Food & vendor', plural: 'Food & vendors', icon: Store, color: '#BE185D', bg: '#FDF2F8' },
  partner: { label: 'Partner', plural: 'Partners', icon: Handshake, color: '#4F46E5', bg: '#EEF2FF' },
  emergency: { label: 'Emergency', plural: 'Emergency', icon: Siren, color: '#D93036', bg: '#FFF0F0' },
  other: { label: 'Other', plural: 'Other', icon: Contact, color: '#52525B', bg: '#F4F4F5' },
};

const EMPTY_DRAFT: ContactDraft = {
  name: '', category: 'hotel', company: null, phone: null, alt_phone: null, whatsapp: true, email: null,
  location: null, address: null, map_url: null, rates: null, rating: null, trip_ids: [], notes: null, is_favorite: false,
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2)) || '?').toUpperCase();
}

function CategoryPill({ category }: { category: ContactCategory }) {
  const c = CATEGORY[category] || CATEGORY.other;
  const Icon = c.icon;
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-semibold" style={{ color: c.color, background: c.bg }}>
      <Icon className="h-3.5 w-3.5" />
      {c.label}
    </span>
  );
}

function Stars({ value, size = 'h-3.5 w-3.5' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= value ? 'fill-[#F5A524] text-[#F5A524]' : 'text-[#D9DAE0]'}`} />
      ))}
    </span>
  );
}

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard blocked
        }
      }}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#E7E8EE] bg-white px-2.5 text-[12px] font-medium text-[#17171C] transition hover:border-[#8758F6] hover:text-[#8758F6]"
      aria-label={`${label} ${value}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-[#30A46C]" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function PhoneActions({ phone, whatsapp }: { phone: string; whatsapp: boolean }) {
  const digits = phoneDigits(phone);
  const action = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition';
  return (
    <div className="flex flex-wrap gap-1.5">
      <a href={`tel:+${digits}`} onClick={(e) => e.stopPropagation()} className={`${action} border-[#E7E8EE] bg-white text-[#17171C] hover:border-[#8758F6] hover:text-[#8758F6]`}>
        <Phone className="h-3.5 w-3.5" /> Call
      </a>
      {whatsapp && (
        <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={`${action} border-[#C9EBD7] bg-[#EEFAF3] text-[#1F7A4A] hover:border-[#30A46C]`}>
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </a>
      )}
      <CopyButton value={phone} />
    </div>
  );
}

interface ContactsViewProps {
  contacts: AdminContact[];
  trips: TripOption[];
  loading?: boolean;
  onSave: (draft: ContactDraft, id?: string) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  onToggleFavorite: (contact: AdminContact) => void;
}

export default function ContactsView({ contacts, trips, loading, onSave, onDelete, onToggleFavorite }: ContactsViewProps) {
  const [category, setCategory] = useState<'all' | ContactCategory>('all');
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('all');
  const [tripId, setTripId] = useState('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [panel, setPanel] = useState<{ mode: 'view' | 'edit'; id: string | null } | null>(null);

  const tripTitle = useMemo(() => new Map(trips.map((t) => [t.id, t.title.trim()])), [trips]);
  const locations = useMemo(
    () => [...new Set(contacts.map((c) => c.location?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)),
    [contacts]
  );

  const baseFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return contacts.filter((c) => {
      if (favoritesOnly && !c.is_favorite) return false;
      if (location !== 'all' && c.location?.trim() !== location) return false;
      if (tripId !== 'all' && !c.trip_ids.includes(tripId)) return false;
      if (!q) return true;
      if (qDigits.length >= 3 && [c.phone, c.alt_phone].some((p) => p?.replace(/\D/g, '').includes(qDigits))) return true;
      return [c.name, c.company, c.location, c.address, c.email, c.notes, c.rates]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [contacts, search, location, tripId, favoritesOnly]);

  const counts = useMemo(() => {
    const map: Partial<Record<ContactCategory, number>> = {};
    for (const c of baseFiltered) map[c.category] = (map[c.category] || 0) + 1;
    return map;
  }, [baseFiltered]);

  const visible = category === 'all' ? baseFiltered : baseFiltered.filter((c) => c.category === category);
  const filtersActive = category !== 'all' || search.trim() !== '' || location !== 'all' || tripId !== 'all' || favoritesOnly;
  const selected = panel?.id ? contacts.find((c) => c.id === panel.id) || null : null;

  const clearFilters = () => {
    setCategory('all');
    setSearch('');
    setLocation('all');
    setTripId('all');
    setFavoritesOnly(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-[#F7F8FC]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#E7E8EE] border-t-[#8758F6] mx-auto"></div>
          <p className="mt-4 text-sm text-[#666873] font-medium">Loading contacts...</p>
        </div>
      </div>
    );
  }

  const selectClass = 'h-10 rounded-xl border border-[#E7E8EE] bg-white px-3 text-sm text-[#17171C] outline-none transition focus:border-[#8758F6] focus:ring-4 focus:ring-[#8758F6]/10';

  return (
    <div className="-m-4 sm:-m-6 min-h-[calc(100vh-4rem)] bg-[#F7F8FC] p-4 sm:p-8 animate-fade-in-up">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] sm:text-[30px] font-bold leading-tight tracking-tight text-[#17171C]">Contacts</h1>
          <p className="mt-1 text-sm text-[#666873]">Hotels, transport, guides and everyone you call to run a trip.</p>
        </div>
        <button
          type="button"
          onClick={() => setPanel({ mode: 'edit', id: null })}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#8758F6] px-4 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(135,88,246,0.25)] transition hover:bg-[#7646EA]"
        >
          <Plus className="h-4 w-4" /> Add contact
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D6D7DE] bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1EBFF]">
            <BookUser className="h-7 w-7 text-[#8758F6]" />
          </div>
          <p className="text-base font-semibold text-[#17171C]">Your address book is empty</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#666873]">
            Start with the hotels, bus operators and trip captains for this Friday&apos;s departures, so their numbers are one tap away.
          </p>
          <button
            type="button"
            onClick={() => setPanel({ mode: 'edit', id: null })}
            className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#8758F6] px-4 text-sm font-semibold text-white transition hover:bg-[#7646EA]"
          >
            <Plus className="h-4 w-4" /> Add first contact
          </button>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative w-full lg:max-w-[420px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666873]" />
                <input
                  id="contacts-search"
                  type="text"
                  placeholder="Search name, phone, place, notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[#E7E8EE] bg-white pl-10 pr-4 text-sm text-[#17171C] outline-none transition placeholder:text-[#8A8C96] focus:border-[#8758F6] focus:ring-4 focus:ring-[#8758F6]/10"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <select id="contacts-location" value={location} onChange={(e) => setLocation(e.target.value)} className={selectClass} aria-label="Filter by location">
                  <option value="all">All places</option>
                  {locations.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <select id="contacts-trip" value={tripId} onChange={(e) => setTripId(e.target.value)} className={selectClass} aria-label="Filter by trip">
                  <option value="all">All trips</option>
                  {trips.map((t) => <option key={t.id} value={t.id}>{t.title.trim()}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setFavoritesOnly((v) => !v)}
                  aria-pressed={favoritesOnly}
                  className={`col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition sm:col-span-1 ${
                    favoritesOnly ? 'border-[#F5C2CF] bg-[#FFF1F4] text-[#C2185B]' : 'border-[#E7E8EE] bg-white text-[#17171C] hover:border-[#C9CBD3]'
                  }`}
                >
                  <Heart className={`h-4 w-4 ${favoritesOnly ? 'fill-[#E5487A] text-[#E5487A]' : ''}`} /> Favourites
                </button>
              </div>
            </div>

            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max gap-2">
                <FilterChip active={category === 'all'} onClick={() => setCategory('all')} label="All" count={baseFiltered.length} />
                {CONTACT_CATEGORIES.map((key) => (
                  <FilterChip
                    key={key}
                    active={category === key}
                    onClick={() => setCategory(key)}
                    label={CATEGORY[key].plural}
                    count={counts[key] || 0}
                    color={CATEGORY[key].color}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Cards */}
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-[#E7E8EE] bg-white px-6 py-14 text-center">
              <Search className="mx-auto mb-3 h-10 w-10 text-[#C6C8D0]" />
              <p className="text-sm text-[#666873]">No contacts match these filters</p>
              {filtersActive && (
                <button type="button" onClick={clearFilters} className="mt-3 text-sm font-semibold text-[#8758F6] hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {visible.map((c) => (
                <li key={c.id}>
                  <ContactCard
                    contact={c}
                    tripTitle={tripTitle}
                    onOpen={() => setPanel({ mode: 'view', id: c.id })}
                    onToggleFavorite={() => onToggleFavorite(c)}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-[#8A8C96]">Showing {visible.length} of {contacts.length} contact{contacts.length === 1 ? '' : 's'}</p>
        </>
      )}

      {panel && (
        <ContactPanel
          key={`${panel.mode}-${panel.id ?? 'new'}`}
          mode={panel.mode}
          contact={selected}
          trips={trips}
          tripTitle={tripTitle}
          locations={locations}
          onClose={() => setPanel(null)}
          onEdit={() => setPanel({ mode: 'edit', id: panel.id })}
          onCancelEdit={() => (panel.id ? setPanel({ mode: 'view', id: panel.id }) : setPanel(null))}
          onSave={async (draft) => {
            const error = await onSave(draft, panel.id ?? undefined);
            if (!error && panel.id) setPanel({ mode: 'view', id: panel.id });
            if (!error && !panel.id) setPanel(null);
            return error;
          }}
          onDelete={async () => {
            if (!panel.id) return null;
            const error = await onDelete(panel.id);
            if (!error) setPanel(null);
            return error;
          }}
        />
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label, count, color }: {
  active: boolean; onClick: () => void; label: string; count: number; color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition ${
        active
          ? 'border-[#17171C] bg-[#17171C] text-white'
          : count === 0
            ? 'border-[#E7E8EE] bg-white text-[#B0B2BA] hover:text-[#666873]'
            : 'border-[#E7E8EE] bg-white text-[#17171C] hover:border-[#C9CBD3]'
      }`}
    >
      {color && !active && count > 0 && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
      {label}
      <span className={`tabular-nums text-xs ${active ? 'text-white/70' : 'text-[#8A8C96]'}`}>{count}</span>
    </button>
  );
}

function ContactCard({ contact: c, tripTitle, onOpen, onToggleFavorite }: {
  contact: AdminContact; tripTitle: Map<string, string>; onOpen: () => void; onToggleFavorite: () => void;
}) {
  const cat = CATEGORY[c.category] || CATEGORY.other;
  const linked = c.trip_ids.map((id) => tripTitle.get(id)).filter(Boolean) as string[];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      className="group flex h-full cursor-pointer flex-col gap-3 rounded-2xl border border-[#E7E8EE] bg-white p-4 shadow-[0_1px_2px_rgba(23,23,28,0.04)] transition hover:border-[#D5C8FB] hover:shadow-[0_10px_24px_rgba(23,23,28,0.06)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#8758F6]/15"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold" style={{ color: cat.color, background: cat.bg }}>
          {initials(c.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-[#17171C]">{c.name}</p>
          <p className={`truncate text-[13px] ${c.company ? 'text-[#666873]' : 'text-[#B0B2BA]'}`}>{c.company || 'No company'}</p>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          aria-label={c.is_favorite ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed={c.is_favorite}
          className="-m-1 rounded-lg p-1.5 text-[#B0B2BA] transition hover:bg-[#FFF1F4] hover:text-[#E5487A]"
        >
          <Heart className={`h-[18px] w-[18px] ${c.is_favorite ? 'fill-[#E5487A] text-[#E5487A]' : ''}`} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <CategoryPill category={c.category} />
        {c.location && (
          <span className="inline-flex min-w-0 items-center gap-1 text-[13px] text-[#666873]">
            <MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{c.location}</span>
          </span>
        )}
        {c.rating ? <Stars value={c.rating} /> : null}
      </div>

      {c.phone ? (
        <div className="flex flex-col gap-2">
          <p className="text-[15px] font-semibold tabular-nums tracking-wide text-[#17171C]">{c.phone}</p>
          <PhoneActions phone={c.phone} whatsapp={c.whatsapp} />
        </div>
      ) : (
        <p className="text-[13px] text-[#B0B2BA]">No phone number</p>
      )}

      {(c.rates || linked.length > 0) && (
        <div className="flex flex-col gap-1.5 border-t border-[#F0F1F5] pt-3">
          {c.rates && <p className="truncate text-[13px] text-[#17171C]" title={c.rates}><span className="text-[#8A8C96]">Rates · </span>{c.rates}</p>}
          {linked.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {linked.slice(0, 2).map((t) => (
                <span key={t} className="max-w-full truncate rounded-md bg-[#F4F4F7] px-2 py-0.5 text-[11.5px] font-medium text-[#555866]">{t}</span>
              ))}
              {linked.length > 2 && <span className="rounded-md bg-[#F4F4F7] px-2 py-0.5 text-[11.5px] font-medium text-[#555866]">+{linked.length - 2}</span>}
            </div>
          )}
        </div>
      )}

      {c.notes && (
        <div className="mt-auto flex gap-2 rounded-xl bg-[#FAFAFD] p-2.5">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8A8C96]" />
          <p className="line-clamp-2 break-words text-[12.5px] leading-relaxed text-[#555866]">{c.notes}</p>
        </div>
      )}
    </div>
  );
}

function ContactPanel({
  mode, contact, trips, tripTitle, locations, onClose, onEdit, onCancelEdit, onSave, onDelete,
}: {
  mode: 'view' | 'edit';
  contact: AdminContact | null;
  trips: TripOption[];
  tripTitle: Map<string, string>;
  locations: string[];
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (draft: ContactDraft) => Promise<string | null>;
  onDelete: () => Promise<string | null>;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const title = mode === 'edit' ? (contact ? 'Edit contact' : 'New contact') : contact?.name || 'Contact';

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[#17171C]/40" onClick={onClose} />
      <aside className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-2xl bg-white shadow-2xl animate-slide-up sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[500px] sm:rounded-none sm:animate-slide-in">
        {mode === 'view' && contact ? (
          <ContactDetails contact={contact} tripTitle={tripTitle} onClose={onClose} onEdit={onEdit} onDelete={onDelete} />
        ) : (
          <ContactForm contact={contact} trips={trips} locations={locations} title={title} onClose={onClose} onCancel={onCancelEdit} onSave={onSave} />
        )}
      </aside>
    </div>
  );
}

function ContactDetails({ contact: c, tripTitle, onClose, onEdit, onDelete }: {
  contact: AdminContact; tripTitle: Map<string, string>; onClose: () => void; onEdit: () => void; onDelete: () => Promise<string | null>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cat = CATEGORY[c.category] || CATEGORY.other;
  const linked = c.trip_ids.map((id) => tripTitle.get(id)).filter(Boolean) as string[];

  const rows: [string, React.ReactNode][] = [
    ['Phone', c.phone ? <div className="flex flex-col gap-2"><span className="font-semibold tabular-nums">{c.phone}</span><PhoneActions phone={c.phone} whatsapp={c.whatsapp} /></div> : null],
    ['Other phone', c.alt_phone ? <div className="flex flex-col gap-2"><span className="font-semibold tabular-nums">{c.alt_phone}</span><PhoneActions phone={c.alt_phone} whatsapp={false} /></div> : null],
    ['Email', c.email ? <div className="flex flex-wrap items-center gap-2"><a href={`mailto:${c.email}`} className="break-all text-[#8758F6] hover:underline">{c.email}</a><CopyButton value={c.email} /></div> : null],
    ['Location', c.location],
    ['Address', c.address ? <span className="whitespace-pre-line">{c.address}</span> : null],
    ['Map', c.map_url ? <a href={c.map_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#8758F6] hover:underline">Open in Maps <ExternalLink className="h-3 w-3" /></a> : null],
    ['Rates', c.rates],
    ['Rating', c.rating ? <Stars value={c.rating} size="h-4 w-4" /> : null],
    ['Trips', linked.length ? <div className="flex flex-wrap gap-1.5">{linked.map((t) => <span key={t} className="rounded-md bg-[#F4F4F7] px-2 py-0.5 text-[12px] font-medium text-[#555866]">{t}</span>)}</div> : null],
  ];

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-[#E7E8EE] px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold" style={{ color: cat.color, background: cat.bg }}>
            {initials(c.name)}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold leading-snug text-[#17171C]">{c.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <CategoryPill category={c.category} />
              {c.company && <span className="truncate text-[13px] text-[#666873]">{c.company}</span>}
              {c.is_favorite && <Heart className="h-4 w-4 fill-[#E5487A] text-[#E5487A]" aria-label="Favourite" />}
            </div>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-1.5 text-[#666873] transition hover:bg-[#F4F4F7] hover:text-[#17171C]">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <dl className="divide-y divide-[#F0F1F5] rounded-xl border border-[#E7E8EE]">
          {rows.filter(([, v]) => v).map(([label, value]) => (
            <div key={label} className="grid grid-cols-[92px_1fr] gap-3 px-3.5 py-3">
              <dt className="text-[13px] text-[#666873]">{label}</dt>
              <dd className="min-w-0 text-sm text-[#17171C]">{value}</dd>
            </div>
          ))}
        </dl>

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#666873]">Notes</p>
          {c.notes ? (
            <p className="whitespace-pre-line break-words rounded-xl bg-[#FAFAFD] p-3.5 text-sm leading-relaxed text-[#17171C]">{c.notes}</p>
          ) : (
            <p className="text-sm text-[#B0B2BA]">No notes yet</p>
          )}
        </div>

        <p className="text-xs text-[#8A8C96]">
          Added {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          {c.updated_at !== c.created_at && ` · updated ${new Date(c.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
        </p>
      </div>

      <div className="border-t border-[#E7E8EE] px-5 py-3.5">
        {error && <p className="mb-2 text-sm text-[#D93036]">{error}</p>}
        {confirmDelete ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm text-[#17171C]">Delete {c.name}? This can&apos;t be undone.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-[#E7E8EE] bg-white px-4 text-sm font-medium text-[#17171C] sm:flex-none">Keep</button>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  const err = await onDelete();
                  setDeleting(false);
                  if (err) setError(err);
                }}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-[#D93036] px-4 text-sm font-semibold text-white transition hover:bg-[#C2272D] disabled:opacity-60 sm:flex-none"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={onEdit} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#8758F6] text-sm font-semibold text-white transition hover:bg-[#7646EA]">
              <Pencil className="h-4 w-4" /> Edit
            </button>
            <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#E7E8EE] bg-white px-4 text-sm font-medium text-[#17171C] transition hover:border-[#E5484D] hover:text-[#D93036]">
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function ContactForm({ contact, trips, locations, title, onClose, onCancel, onSave }: {
  contact: AdminContact | null; trips: TripOption[]; locations: string[]; title: string;
  onClose: () => void; onCancel: () => void; onSave: (draft: ContactDraft) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState<ContactDraft>(() => {
    if (!contact) return EMPTY_DRAFT;
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = contact;
    return rest;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setText = (key: keyof ContactDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    set(key, (e.target.value || null) as never);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    const err = await onSave(draft);
    setSaving(false);
    if (err) setError(err);
  };

  const input = 'h-10 w-full rounded-xl border border-[#E7E8EE] bg-white px-3 text-sm text-[#17171C] outline-none transition placeholder:text-[#A5A7B0] focus:border-[#8758F6] focus:ring-4 focus:ring-[#8758F6]/10';
  const label = 'mb-1.5 block text-[13px] font-medium text-[#17171C]';

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <div className="flex items-center justify-between gap-3 border-b border-[#E7E8EE] px-5 py-4">
        <h2 className="text-lg font-bold text-[#17171C]">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-1.5 text-[#666873] transition hover:bg-[#F4F4F7] hover:text-[#17171C]">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div>
          <label htmlFor="contact-name" className={label}>Name <span className="text-[#D93036]">*</span></label>
          <input id="contact-name" autoFocus value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Ramesh Thakur" className={input} />
        </div>

        <div>
          <span className={label}>Type</span>
          <div className="flex flex-wrap gap-1.5">
            {CONTACT_CATEGORIES.map((key) => {
              const c = CATEGORY[key];
              const Icon = c.icon;
              const active = draft.category === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => set('category', key)}
                  aria-pressed={active}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-semibold transition ${active ? '' : 'border-[#E7E8EE] bg-white text-[#555866] hover:border-[#C9CBD3]'}`}
                  style={active ? { color: c.color, background: c.bg, borderColor: c.color } : undefined}
                >
                  <Icon className="h-3.5 w-3.5" /> {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="contact-company" className={label}>Company / business</label>
          <input id="contact-company" value={draft.company || ''} onChange={setText('company')} placeholder="e.g. Hotel Snow Peak, Kasol" className={input} />
        </div>

        <fieldset className="space-y-3 rounded-xl border border-[#E7E8EE] p-3.5">
          <legend className="px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#666873]">How to reach</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-phone" className={label}>Phone</label>
              <input id="contact-phone" type="tel" inputMode="tel" value={draft.phone || ''} onChange={setText('phone')} placeholder="98765 43210" className={input} />
            </div>
            <div>
              <label htmlFor="contact-alt-phone" className={label}>Other phone</label>
              <input id="contact-alt-phone" type="tel" inputMode="tel" value={draft.alt_phone || ''} onChange={setText('alt_phone')} placeholder="Optional" className={input} />
            </div>
          </div>
          <label htmlFor="contact-whatsapp" className="flex cursor-pointer items-center gap-2 text-sm text-[#17171C]">
            <input id="contact-whatsapp" type="checkbox" checked={draft.whatsapp} onChange={(e) => set('whatsapp', e.target.checked)} className="h-4 w-4 rounded border-[#C6C8D0] accent-[#8758F6]" />
            WhatsApp works on the main number
          </label>
          <div>
            <label htmlFor="contact-email" className={label}>Email</label>
            <input id="contact-email" type="email" value={draft.email || ''} onChange={setText('email')} placeholder="Optional" className={input} />
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-xl border border-[#E7E8EE] p-3.5">
          <legend className="px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#666873]">Where</legend>
          <div>
            <label htmlFor="contact-location" className={label}>Location</label>
            <input id="contact-location" list="contact-locations" value={draft.location || ''} onChange={setText('location')} placeholder="e.g. Kasol, Delhi (Kashmere Gate)" className={input} />
            <datalist id="contact-locations">{locations.map((l) => <option key={l} value={l} />)}</datalist>
          </div>
          <div>
            <label htmlFor="contact-address" className={label}>Address</label>
            <textarea id="contact-address" rows={2} value={draft.address || ''} onChange={setText('address')} placeholder="Optional" className={`${input} h-auto py-2.5`} />
          </div>
          <div>
            <label htmlFor="contact-map" className={label}>Google Maps link</label>
            <input id="contact-map" type="url" value={draft.map_url || ''} onChange={setText('map_url')} placeholder="https://maps.app.goo.gl/..." className={input} />
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-xl border border-[#E7E8EE] p-3.5">
          <legend className="px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#666873]">Work details</legend>
          <div>
            <label htmlFor="contact-rates" className={label}>Rates</label>
            <input id="contact-rates" value={draft.rates || ''} onChange={setText('rates')} placeholder="e.g. ₹1,800 / room / night, breakfast included" className={input} />
          </div>
          <div>
            <span className={label}>Your rating</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set('rating', draft.rating === n ? null : n)}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  className="rounded-md p-0.5 transition hover:scale-110"
                >
                  <Star className={`h-6 w-6 ${draft.rating && n <= draft.rating ? 'fill-[#F5A524] text-[#F5A524]' : 'text-[#D9DAE0]'}`} />
                </button>
              ))}
              {draft.rating && <button type="button" onClick={() => set('rating', null)} className="ml-2 text-xs font-medium text-[#8A8C96] hover:text-[#17171C]">Clear</button>}
            </div>
          </div>
          {trips.length > 0 && (
            <div>
              <span className={label}>Used for trips</span>
              <div className="flex flex-wrap gap-1.5">
                {trips.map((t) => {
                  const active = draft.trip_ids.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set('trip_ids', active ? draft.trip_ids.filter((id) => id !== t.id) : [...draft.trip_ids, t.id])}
                      className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[12.5px] font-medium transition ${
                        active ? 'border-[#8758F6] bg-[#F1EBFF] text-[#6D3FE0]' : 'border-[#E7E8EE] bg-white text-[#555866] hover:border-[#C9CBD3]'
                      }`}
                    >
                      {active && <Check className="h-3.5 w-3.5" />}
                      {t.title.trim()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </fieldset>

        <div>
          <label htmlFor="contact-notes" className={label}>Notes</label>
          <textarea
            id="contact-notes"
            rows={4}
            value={draft.notes || ''}
            onChange={setText('notes')}
            placeholder="Best time to call, payment terms, what went well or badly last time..."
            className={`${input} h-auto py-2.5 leading-relaxed`}
          />
        </div>

        <label htmlFor="contact-favorite" className="flex cursor-pointer items-center gap-2 text-sm text-[#17171C]">
          <input id="contact-favorite" type="checkbox" checked={draft.is_favorite} onChange={(e) => set('is_favorite', e.target.checked)} className="h-4 w-4 rounded border-[#C6C8D0] accent-[#E5487A]" />
          Add to favourites (shown first)
        </label>
      </div>

      <div className="border-t border-[#E7E8EE] px-5 py-3.5">
        {error && <p className="mb-2 text-sm text-[#D93036]" role="alert">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#8758F6] text-sm font-semibold text-white transition hover:bg-[#7646EA] disabled:opacity-60">
            <Check className="h-4 w-4" /> {saving ? 'Saving…' : contact ? 'Save changes' : 'Add contact'}
          </button>
          <button type="button" onClick={onCancel} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#E7E8EE] bg-white px-4 text-sm font-medium text-[#17171C] transition hover:border-[#C9CBD3]">
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
