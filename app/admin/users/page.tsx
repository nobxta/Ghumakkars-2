'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  X,
  Copy,
  Check,
  MessageCircle,
  Mail,
  MoreVertical,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Phone,
  Ticket,
  IndianRupee,
} from 'lucide-react';
import styles from './users-page.module.css';
import { AdminListSkeleton } from '@/components/ui/Skeleton';

const PAGE_SIZE = 20;

export interface UserProfile {
  id: string;
  email?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  booking_count?: number;
  bookings_count?: number;
  total_spent?: number;
  spending?: number;
  [key: string]: any;
}

type ChipFilter = 'all' | 'with_bookings' | 'no_bookings';
type DateFilter = 'all' | '7d' | '30d' | '90d' | 'this_year';
type BookingFilter = 'all' | 'none' | 'has' | 'multiple';
type SortField = 'registered' | 'name' | 'bookings' | 'spending';
type SortOrder = 'asc' | 'desc';

function getUserName(user: UserProfile): string {
  if (user.full_name && user.full_name.trim().length > 0) {
    return user.full_name.trim();
  }
  const parts = [user.first_name, user.last_name].filter(Boolean).map((s) => String(s).trim());
  if (parts.length > 0) {
    return parts.join(' ');
  }
  return 'Unnamed User';
}

function getInitials(name: string): string {
  if (!name || name === 'Unnamed User') return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatRegistrationDate(date: string | null | undefined): string {
  if (!date) return '—';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return '—';
  }
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const trimmed = phone.trim();
  return trimmed || '—';
}

function formatCurrency(value: unknown): string {
  const num = Number(value || 0);
  if (isNaN(num) || num === 0) return '₹0';
  return `₹${num.toLocaleString('en-IN')}`;
}

export default function AdminUsersPage() {
  const router = useRouter();

  // Primary Data
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [bookingCounts, setBookingCounts] = useState<Record<string, number>>({});
  const [userSpendings, setUserSpendings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [chipFilter, setChipFilter] = useState<ChipFilter>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>('all');

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState<SortField>('registered');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Interactive action menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Refs
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  }, []);

  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [usersRes, bookingsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/bookings').catch(() => null),
      ]);

      if (!usersRes.ok) {
        throw new Error('Failed to load registered users');
      }

      const { users: fetchedUsers } = await usersRes.json();
      setUsers(fetchedUsers || []);

      if (bookingsRes && bookingsRes.ok) {
        try {
          const { bookings: fetchedBookings } = await bookingsRes.json();
          const counts: Record<string, number> = {};
          const spendings: Record<string, number> = {};

          if (Array.isArray(fetchedBookings)) {
            fetchedBookings.forEach((b: any) => {
              if (b?.user_id) {
                counts[b.user_id] = (counts[b.user_id] || 0) + 1;

                // Calculate spending for this booking
                let bookingAmount = 0;
                if (Array.isArray(b.payment_transactions) && b.payment_transactions.length > 0) {
                  const verified = b.payment_transactions
                    .filter((pt: any) => pt.payment_status === 'verified')
                    .reduce((sum: number, pt: any) => sum + (parseFloat(String(pt.amount || 0)) || 0), 0);
                  if (verified > 0) {
                    bookingAmount = verified;
                  }
                }

                if (bookingAmount === 0 && b.amount_paid != null && !isNaN(parseFloat(String(b.amount_paid)))) {
                  const amt = parseFloat(String(b.amount_paid));
                  if (amt > 0) bookingAmount = amt;
                }

                if (bookingAmount === 0 && (b.booking_status === 'confirmed' || b.payment_status === 'paid')) {
                  const total = parseFloat(String(b.final_amount || b.total_price || 0));
                  if (!isNaN(total) && total > 0) bookingAmount = total;
                }

                if (bookingAmount === 0 && b.payment_status === 'partial') {
                  const amt = parseFloat(String(b.amount_paid || 0));
                  if (!isNaN(amt) && amt > 0) bookingAmount = amt;
                }

                spendings[b.user_id] = (spendings[b.user_id] || 0) + bookingAmount;
              }
            });
          }
          setBookingCounts(counts);
          setUserSpendings(spendings);
        } catch {
          // Graceful fallback
        }
      }
    } catch (err: any) {
      console.error('Error fetching registered users:', err);
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Keyboard navigation & click outside listeners
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        isFilterOpen &&
        filterPanelRef.current &&
        !filterPanelRef.current.contains(target) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(target)
      ) {
        setIsFilterOpen(false);
      }
      if (activeMenuId && !(e.target as Element)?.closest?.('[data-menu-container]')) {
        setActiveMenuId(null);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (isFilterOpen) {
          setIsFilterOpen(false);
          filterButtonRef.current?.focus();
        }
        if (activeMenuId) {
          setActiveMenuId(null);
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterOpen, activeMenuId]);

  // Dynamic booking segmentation counts
  const dynamicCounts = useMemo(() => {
    let withBookings = 0;
    let noBookings = 0;

    users.forEach((u) => {
      const count = bookingCounts[u.id] ?? u.booking_count ?? u.bookings_count ?? 0;
      if (count > 0) {
        withBookings += 1;
      } else {
        noBookings += 1;
      }
    });

    return {
      all: users.length,
      withBookings,
      noBookings,
    };
  }, [users, bookingCounts]);

  // Chip filter handler
  const handleChipClick = (chip: ChipFilter) => {
    setChipFilter(chip);
    if (chip === 'all') {
      setBookingFilter('all');
    } else if (chip === 'with_bookings') {
      setBookingFilter('has');
    } else if (chip === 'no_bookings') {
      setBookingFilter('none');
    }
    setCurrentPage(1);
  };

  const resetAllFilters = () => {
    setSearchTerm('');
    setChipFilter('all');
    setDateFilter('all');
    setBookingFilter('all');
    setCurrentPage(1);
  };

  const hasActiveAdvancedFilters = dateFilter !== 'all' || bookingFilter !== 'all';

  // Filter users based on search and filters
  const filteredUsers = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();

    return users.filter((user) => {
      // 1. Search term match (name, email, phone)
      if (searchLower) {
        const emailMatch = user.email?.toLowerCase().includes(searchLower);
        const firstNameMatch = user.first_name?.toLowerCase().includes(searchLower);
        const lastNameMatch = user.last_name?.toLowerCase().includes(searchLower);
        const fullNameMatch = user.full_name?.toLowerCase().includes(searchLower);
        const phoneMatch =
          user.phone?.includes(searchTerm) || user.phone_number?.includes(searchTerm);

        if (!emailMatch && !firstNameMatch && !lastNameMatch && !fullNameMatch && !phoneMatch) {
          return false;
        }
      }

      // 2. Booking filter match
      const count = bookingCounts[user.id] ?? user.booking_count ?? user.bookings_count ?? 0;
      if (bookingFilter === 'none' && count !== 0) return false;
      if (bookingFilter === 'has' && count < 1) return false;
      if (bookingFilter === 'multiple' && count < 2) return false;

      // 3. Registration date filter match
      if (dateFilter !== 'all' && user.created_at) {
        const createdMs = new Date(user.created_at).getTime();
        const nowMs = Date.now();
        if (isNaN(createdMs)) return true;

        if (dateFilter === '7d' && createdMs < nowMs - 7 * 24 * 60 * 60 * 1000) return false;
        if (dateFilter === '30d' && createdMs < nowMs - 30 * 24 * 60 * 60 * 1000) return false;
        if (dateFilter === '90d' && createdMs < nowMs - 90 * 24 * 60 * 60 * 1000) return false;
        if (dateFilter === 'this_year') {
          const currentYear = new Date().getFullYear();
          if (new Date(user.created_at).getFullYear() !== currentYear) return false;
        }
      }

      return true;
    });
  }, [users, searchTerm, bookingFilter, dateFilter, bookingCounts]);

  // Sorting
  const sortedUsers = useMemo(() => {
    const list = [...filteredUsers];
    list.sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = getUserName(a).toLowerCase();
        const nameB = getUserName(b).toLowerCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      if (sortBy === 'bookings') {
        const countA = bookingCounts[a.id] ?? a.booking_count ?? a.bookings_count ?? 0;
        const countB = bookingCounts[b.id] ?? b.booking_count ?? b.bookings_count ?? 0;
        return sortOrder === 'asc' ? countA - countB : countB - countA;
      }
      if (sortBy === 'spending') {
        const spendA = userSpendings[a.id] ?? a.total_spent ?? a.spending ?? 0;
        const spendB = userSpendings[b.id] ?? b.total_spent ?? b.spending ?? 0;
        return sortOrder === 'asc' ? spendA - spendB : spendB - spendA;
      }
      // Default: registered date
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    return list;
  }, [filteredUsers, sortBy, sortOrder, bookingCounts, userSpendings]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedUsers = sortedUsers.slice(pageStartIndex, pageStartIndex + PAGE_SIZE);
  const showPagination = sortedUsers.length > PAGE_SIZE || safePage > 1;

  // Toggle sort order
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Generate pagination page numbers with smart ellipsis
  const paginationRange = useMemo(() => {
    const total = totalPages;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (safePage <= 3) {
      return [1, 2, 3, 4, '...', total];
    }
    if (safePage >= total - 2) {
      return [1, '...', total - 3, total - 2, total - 1, total];
    }
    return [1, '...', safePage - 1, safePage, safePage + 1, '...', total];
  }, [totalPages, safePage]);

  // Loading view
  if (loading) {
    return <div className="-m-4 sm:-m-6 min-h-[calc(100vh-3.5rem)] bg-[#F8F9FC] p-4 sm:p-6 lg:p-8"><AdminListSkeleton label="Loading users" /></div>;
  }

  // Error state
  if (error && users.length === 0) {
    return (
      <div
        className={`admin-users-page ${styles.pageRoot} -m-4 sm:-m-6 min-h-[calc(100vh-3.5rem)] bg-[#F8F9FC] p-4 sm:p-6 lg:p-8 flex items-center justify-center`}
      >
        <div className="text-center p-8 bg-white rounded-2xl border border-[#FECACA] shadow-sm max-w-md w-full">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-[18px] font-bold text-[#171923]">Failed to load users</h2>
          <p className="mt-2 text-[13px] text-[#64748B]">{error}</p>
          <button
            type="button"
            onClick={() => fetchData()}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[13px] font-medium rounded-xl transition shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`admin-users-page ${styles.pageRoot} -m-4 sm:-m-6 min-h-[calc(100vh-3.5rem)] bg-[#F8F9FC] p-4 sm:p-6 lg:p-8 font-sans text-[#171923]`}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#171923] text-white text-[13px] px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Screen reader live region for search results */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`Showing ${paginatedUsers.length} of ${sortedUsers.length} filtered users.`}
      </div>

      {/* Heading Section */}
      <header className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[22px] sm:text-[24px] font-bold tracking-tight text-[#171923]">
                Registered Users
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#F3E8FF] text-[#7C3AED] border border-[#DDD6FE]">
                {users.length} {users.length === 1 ? 'user' : 'users'}
              </span>
            </div>
            <p className="mt-1 text-[13px] sm:text-[14px] text-[#64748B]">
              Manage your customers and view their details.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#64748B] hover:text-[#171923] bg-white border border-[#E8EAF0] hover:border-[#CBD5E1] rounded-xl transition ${styles.focusable}`}
              aria-label="Refresh user list"
              title="Refresh data"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#64748B] ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Search & Filter Controls Section */}
      <section aria-label="Search and filter users" className="mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1 max-w-full sm:max-w-md">
            <label htmlFor="admin-users-search" className="sr-only">
              Search by name, email, or phone
            </label>
            <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center">
              <Search className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />
            </div>
            <input
              id="admin-users-search"
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name, email, or phone..."
              className={`w-full h-10 pl-10 pr-9 text-[13px] text-[#171923] bg-white border border-[#E8EAF0] rounded-xl placeholder-[#94A3B8] transition focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15 outline-none ${styles.focusable}`}
            />
            {searchTerm.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-[#171923]"
                aria-label="Clear search input"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Advanced Filters Trigger */}
          <div className="relative">
            <button
              ref={filterButtonRef}
              type="button"
              onClick={() => setIsFilterOpen((prev) => !prev)}
              aria-expanded={isFilterOpen}
              aria-controls="advanced-filters-panel"
              aria-haspopup="true"
              className={`inline-flex items-center justify-between gap-2 h-10 px-3.5 text-[13px] font-medium bg-white border rounded-xl transition ${
                hasActiveAdvancedFilters
                  ? 'border-[#7C3AED] text-[#7C3AED] bg-[#F3E8FF]/20'
                  : 'border-[#E8EAF0] text-[#64748B] hover:text-[#171923] hover:border-[#CBD5E1]'
              } ${styles.focusable}`}
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Filters</span>
                {hasActiveAdvancedFilters && (
                  <span className="w-2 h-2 rounded-full bg-[#7C3AED]" aria-hidden="true" />
                )}
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#94A3B8] transition-transform duration-200 ${
                  isFilterOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {/* Advanced Filters Dropdown Panel */}
            {isFilterOpen && (
              <div
                ref={filterPanelRef}
                id="advanced-filters-panel"
                role="region"
                aria-label="Advanced filters"
                className={`absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-80 z-30 p-4 bg-white rounded-2xl border border-[#E8EAF0] ${styles.popoverShadow} space-y-4 animate-in fade-in zoom-in-95 duration-150`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#E8EAF0]">
                  <span className="text-[13px] font-semibold text-[#171923]">Filter Users</span>
                  {hasActiveAdvancedFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setDateFilter('all');
                        setBookingFilter('all');
                        setChipFilter('all');
                        setCurrentPage(1);
                      }}
                      className="text-[12px] font-medium text-[#7C3AED] hover:underline"
                    >
                      Reset all
                    </button>
                  )}
                </div>

                {/* Filter 1: Registration Date */}
                <div>
                  <label
                    htmlFor="filter-date"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748B] mb-1.5"
                  >
                    Registration Date
                  </label>
                  <select
                    id="filter-date"
                    value={dateFilter}
                    onChange={(e) => {
                      setDateFilter(e.target.value as DateFilter);
                      setCurrentPage(1);
                    }}
                    className={`w-full h-9 px-3 text-[13px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-lg text-[#171923] outline-none focus:border-[#7C3AED] ${styles.focusable}`}
                  >
                    <option value="all">All time</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="this_year">This year</option>
                  </select>
                </div>

                {/* Filter 2: Booking Count */}
                <div>
                  <label
                    htmlFor="filter-bookings"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748B] mb-1.5"
                  >
                    Bookings Count
                  </label>
                  <select
                    id="filter-bookings"
                    value={bookingFilter}
                    onChange={(e) => {
                      const val = e.target.value as BookingFilter;
                      setBookingFilter(val);
                      if (val === 'has') setChipFilter('with_bookings');
                      else if (val === 'none') setChipFilter('no_bookings');
                      else setChipFilter('all');
                      setCurrentPage(1);
                    }}
                    className={`w-full h-9 px-3 text-[13px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-lg text-[#171923] outline-none focus:border-[#7C3AED] ${styles.focusable}`}
                  >
                    <option value="all">Any bookings count</option>
                    <option value="none">No bookings (0)</option>
                    <option value="has">With bookings (1+)</option>
                    <option value="multiple">Multiple bookings (2+)</option>
                  </select>
                </div>

                {/* Action button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="w-full py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[13px] font-medium rounded-xl transition shadow-sm text-center"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Compact Filter Chips Row */}
        <div
          role="group"
          aria-label="Quick user filters"
          className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5"
        >
          {/* Chip 1: All Users */}
          <button
            type="button"
            onClick={() => handleChipClick('all')}
            aria-pressed={chipFilter === 'all' && !hasActiveAdvancedFilters}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-lg transition shrink-0 ${
              chipFilter === 'all' && !hasActiveAdvancedFilters
                ? 'bg-[#7C3AED] text-white font-medium shadow-sm'
                : 'bg-white text-[#64748B] border border-[#E8EAF0] hover:text-[#171923] hover:border-[#CBD5E1]'
            } ${styles.focusable}`}
          >
            <span>All Users</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] ${
                chipFilter === 'all' && !hasActiveAdvancedFilters
                  ? 'bg-white/20 text-white'
                  : 'bg-[#F1F5F9] text-[#64748B]'
              }`}
            >
              {dynamicCounts.all}
            </span>
          </button>

          {/* Chip 2: With Bookings */}
          <button
            type="button"
            onClick={() => handleChipClick('with_bookings')}
            aria-pressed={chipFilter === 'with_bookings'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-lg transition shrink-0 ${
              chipFilter === 'with_bookings'
                ? 'bg-[#7C3AED] text-white font-medium shadow-sm'
                : 'bg-white text-[#64748B] border border-[#E8EAF0] hover:text-[#171923] hover:border-[#CBD5E1]'
            } ${styles.focusable}`}
          >
            <span>With Bookings</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] ${
                chipFilter === 'with_bookings'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#F1F5F9] text-[#64748B]'
              }`}
            >
              {dynamicCounts.withBookings}
            </span>
          </button>

          {/* Chip 3: No Bookings */}
          <button
            type="button"
            onClick={() => handleChipClick('no_bookings')}
            aria-pressed={chipFilter === 'no_bookings'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-lg transition shrink-0 ${
              chipFilter === 'no_bookings'
                ? 'bg-[#7C3AED] text-white font-medium shadow-sm'
                : 'bg-white text-[#64748B] border border-[#E8EAF0] hover:text-[#171923] hover:border-[#CBD5E1]'
            } ${styles.focusable}`}
          >
            <span>No Bookings</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] ${
                chipFilter === 'no_bookings'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#F1F5F9] text-[#64748B]'
              }`}
            >
              {dynamicCounts.noBookings}
            </span>
          </button>

          {/* Clear Filter Chip (if filtered) */}
          {(searchTerm || hasActiveAdvancedFilters || chipFilter !== 'all') && (
            <button
              type="button"
              onClick={resetAllFilters}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] text-[#64748B] hover:text-[#171923] hover:underline transition shrink-0 ml-auto ${styles.focusable}`}
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear filters</span>
            </button>
          )}
        </div>
      </section>

      {/* Main Container: Desktop Table + Mobile Cards */}
      <section
        aria-label="Registered users table and cards"
        className={`bg-white rounded-2xl border border-[#E8EAF0] ${styles.cardShadow} overflow-hidden`}
      >
        {/* Desktop Table View (Hidden on mobile < 768px) */}
        <div className={`hidden md:block overflow-x-auto ${styles.tableScrollbar}`}>
          <table className="w-full min-w-[840px] text-left border-collapse">
            <thead className="bg-[#FAF8FC] border-b border-[#E8EAF0] h-[42px]">
              <tr>
                {/* Column 1: User */}
                <th
                  scope="col"
                  className="px-5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] w-[32%]"
                >
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className={`inline-flex items-center gap-1.5 uppercase hover:text-[#171923] transition ${styles.focusable}`}
                    aria-label={`Sort by user name ${
                      sortBy === 'name' && sortOrder === 'asc' ? 'descending' : 'ascending'
                    }`}
                  >
                    <span>User</span>
                    {sortBy === 'name' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-[#7C3AED]" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-[#7C3AED]" aria-hidden="true" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#CBD5E1]" aria-hidden="true" />
                    )}
                  </button>
                </th>

                {/* Column 2: Phone */}
                <th
                  scope="col"
                  className="px-5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] w-[18%]"
                >
                  Phone
                </th>

                {/* Column 3: Bookings */}
                <th
                  scope="col"
                  className="px-5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] w-[12%]"
                >
                  <button
                    type="button"
                    onClick={() => handleSort('bookings')}
                    className={`inline-flex items-center gap-1.5 uppercase hover:text-[#171923] transition ${styles.focusable}`}
                    aria-label={`Sort by total bookings ${
                      sortBy === 'bookings' && sortOrder === 'asc' ? 'descending' : 'ascending'
                    }`}
                  >
                    <span>Bookings</span>
                    {sortBy === 'bookings' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-[#7C3AED]" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-[#7C3AED]" aria-hidden="true" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#CBD5E1]" aria-hidden="true" />
                    )}
                  </button>
                </th>

                {/* Column 4: Spending */}
                <th
                  scope="col"
                  className="px-5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] w-[14%]"
                >
                  <button
                    type="button"
                    onClick={() => handleSort('spending')}
                    className={`inline-flex items-center gap-1.5 uppercase hover:text-[#171923] transition ${styles.focusable}`}
                    aria-label={`Sort by total spending ${
                      sortBy === 'spending' && sortOrder === 'asc' ? 'descending' : 'ascending'
                    }`}
                  >
                    <span>Spending</span>
                    {sortBy === 'spending' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-[#7C3AED]" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-[#7C3AED]" aria-hidden="true" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#CBD5E1]" aria-hidden="true" />
                    )}
                  </button>
                </th>

                {/* Column 5: Registered */}
                <th
                  scope="col"
                  className="px-5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] w-[14%]"
                >
                  <button
                    type="button"
                    onClick={() => handleSort('registered')}
                    className={`inline-flex items-center gap-1.5 uppercase hover:text-[#171923] transition ${styles.focusable}`}
                    aria-label={`Sort by registration date ${
                      sortBy === 'registered' && sortOrder === 'asc' ? 'descending' : 'ascending'
                    }`}
                  >
                    <span>Registered</span>
                    {sortBy === 'registered' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-[#7C3AED]" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-[#7C3AED]" aria-hidden="true" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#CBD5E1]" aria-hidden="true" />
                    )}
                  </button>
                </th>

                {/* Column 6: Actions */}
                <th
                  scope="col"
                  className="px-5 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] w-[10%]"
                >
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#E8EAF0]">
              {paginatedUsers.map((user) => {
                const name = getUserName(user);
                const phone = user.phone || user.phone_number;
                const bookingCount =
                  bookingCounts[user.id] ?? user.booking_count ?? user.bookings_count ?? 0;
                const spending =
                  userSpendings[user.id] ?? user.total_spent ?? user.spending ?? 0;
                const initials = getInitials(name);
                const isMenuOpen = activeMenuId === user.id;

                return (
                  <tr
                    key={user.id}
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                    className="h-[56px] hover:bg-[#FAF8FF] transition-colors cursor-pointer group"
                  >
                    {/* User: Avatar, Name, Email */}
                    <td className="px-5 py-2">
                      <div className="flex items-center gap-3">
                        <div className="relative w-9 h-9 rounded-full shrink-0 bg-[#F3E8FF] text-[#7C3AED] flex items-center justify-center font-semibold text-[13px] border border-[#E9D5FF] overflow-hidden">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span>{initials}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/users/${user.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block truncate text-[14px] font-semibold text-[#171923] hover:text-[#7C3AED] transition-colors"
                          >
                            {name}
                          </Link>
                          <div className="truncate text-[12px] text-[#64748B]">
                            {user.email || '—'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-5 py-2">
                      <span className="text-[13px] text-[#171923] whitespace-nowrap">
                        {formatPhone(phone)}
                      </span>
                    </td>

                    {/* Bookings */}
                    <td className="px-5 py-2">
                      <span
                        className={`inline-flex items-center justify-center min-w-[28px] h-6 px-2 text-[12px] font-medium rounded-full ${
                          bookingCount > 0
                            ? 'bg-[#F3E8FF] text-[#7C3AED] font-semibold'
                            : 'bg-[#F1F5F9] text-[#64748B]'
                        }`}
                      >
                        {bookingCount}
                      </span>
                    </td>

                    {/* Spending */}
                    <td className="px-5 py-2">
                      <span
                        className={`text-[13px] whitespace-nowrap ${
                          spending > 0
                            ? 'font-semibold text-[#171923]'
                            : 'font-normal text-[#94A3B8]'
                        }`}
                      >
                        {formatCurrency(spending)}
                      </span>
                    </td>

                    {/* Registered */}
                    <td className="px-5 py-2">
                      <span className="text-[13px] text-[#64748B] whitespace-nowrap">
                        {formatRegistrationDate(user.created_at)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-2 text-right">
                      <div
                        className="relative inline-flex items-center justify-end gap-1.5"
                        data-menu-container
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* View Profile Link */}
                        <Link
                          href={`/admin/users/${user.id}`}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-semibold text-[#7C3AED] bg-[#F3E8FF]/70 hover:bg-[#F3E8FF] rounded-lg transition ${styles.focusable}`}
                          aria-label={`View ${name}'s profile`}
                        >
                          <span>View</span>
                        </Link>

                        {/* Three-Dot Menu Button */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMenuId((prev) => (prev === user.id ? null : user.id))
                            }
                            aria-expanded={isMenuOpen}
                            aria-haspopup="menu"
                            aria-label={`More actions for ${name}`}
                            className={`p-1.5 text-[#94A3B8] hover:text-[#171923] hover:bg-[#F1F5F9] rounded-lg transition ${styles.focusable}`}
                          >
                            <MoreVertical className="w-4 h-4" aria-hidden="true" />
                          </button>

                          {/* Action Dropdown Menu */}
                          {isMenuOpen && (
                            <div
                              role="menu"
                              aria-orientation="vertical"
                              className={`absolute right-0 top-full mt-1 w-44 z-40 bg-white rounded-xl border border-[#E8EAF0] ${styles.popoverShadow} py-1 text-left animate-in fade-in zoom-in-95 duration-100`}
                            >
                              <Link
                                href={`/admin/users/${user.id}`}
                                role="menuitem"
                                tabIndex={0}
                                className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-[#171923] hover:bg-[#F8F9FC] transition"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-[#64748B]" />
                                <span>View profile</span>
                              </Link>

                              <button
                                type="button"
                                role="menuitem"
                                tabIndex={0}
                                onClick={() => {
                                  navigator.clipboard?.writeText(user.id);
                                  showToast('User ID copied to clipboard');
                                  setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-[#171923] hover:bg-[#F8F9FC] transition text-left"
                              >
                                <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                                <span>Copy user ID</span>
                              </button>

                              {user.email && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  tabIndex={0}
                                  onClick={() => {
                                    navigator.clipboard?.writeText(user.email || '');
                                    showToast('Email address copied');
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-[#171923] hover:bg-[#F8F9FC] transition text-left"
                                >
                                  <Mail className="w-3.5 h-3.5 text-[#64748B]" />
                                  <span>Copy email</span>
                                </button>
                              )}

                              {phone && (
                                <a
                                  href={`https://wa.me/91${String(phone).replace(/\D/g, '').slice(-10)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  role="menuitem"
                                  tabIndex={0}
                                  className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-[#171923] hover:bg-[#F8F9FC] transition"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>WhatsApp</span>
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Compact User Cards (< 768px) */}
        <div className="block md:hidden divide-y divide-[#E8EAF0]">
          {paginatedUsers.map((user) => {
            const name = getUserName(user);
            const phone = user.phone || user.phone_number;
            const bookingCount =
              bookingCounts[user.id] ?? user.booking_count ?? user.bookings_count ?? 0;
            const spending =
              userSpendings[user.id] ?? user.total_spent ?? user.spending ?? 0;
            const initials = getInitials(name);
            const isMenuOpen = activeMenuId === user.id;

            return (
              <div
                key={user.id}
                onClick={() => router.push(`/admin/users/${user.id}`)}
                className="p-4 hover:bg-[#FAF8FF] transition-colors cursor-pointer space-y-3"
              >
                {/* Top Row: Avatar + Name & Email */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full shrink-0 bg-[#F3E8FF] text-[#7C3AED] flex items-center justify-center font-semibold text-[14px] border border-[#E9D5FF] overflow-hidden">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/admin/users/${user.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate text-[14px] font-semibold text-[#171923] hover:text-[#7C3AED]"
                      >
                        {name}
                      </Link>
                      <div className="truncate text-[12px] text-[#64748B]">
                        {user.email || '—'}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center justify-center min-w-[28px] h-6 px-2 text-[12px] font-medium rounded-full ${
                      bookingCount > 0
                        ? 'bg-[#F3E8FF] text-[#7C3AED] font-semibold'
                        : 'bg-[#F1F5F9] text-[#64748B]'
                    }`}
                  >
                    {bookingCount} {bookingCount === 1 ? 'booking' : 'bookings'}
                  </span>
                </div>

                {/* Info Grid: Phone, Spending & Registration date */}
                <div className="grid grid-cols-2 gap-2 text-[12px] pt-1">
                  <div className="flex items-center gap-1.5 text-[#64748B]">
                    <Phone className="w-3.5 h-3.5 text-[#94A3B8]" aria-hidden="true" />
                    <span className="truncate text-[#171923]">{formatPhone(phone)}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[#64748B]">
                    <IndianRupee className="w-3.5 h-3.5 text-[#94A3B8]" aria-hidden="true" />
                    <span>
                      Spent: <strong className="text-[#171923]">{formatCurrency(spending)}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[#64748B] col-span-2">
                    <Calendar className="w-3.5 h-3.5 text-[#94A3B8]" aria-hidden="true" />
                    <span>Registered {formatRegistrationDate(user.created_at)}</span>
                  </div>
                </div>

                {/* Bottom Row Actions */}
                <div
                  className="flex items-center justify-between pt-2 border-t border-[#F1F5F9]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link
                    href={`/admin/users/${user.id}`}
                    className={`inline-flex items-center justify-center px-3 py-1.5 min-h-[36px] text-[12px] font-semibold text-[#7C3AED] bg-[#F3E8FF] hover:bg-[#E9D5FF] rounded-lg transition ${styles.focusable}`}
                    aria-label={`View profile for ${name}`}
                  >
                    View Details
                  </Link>

                  <div className="relative" data-menu-container>
                    <button
                      type="button"
                      onClick={() => setActiveMenuId((prev) => (prev === user.id ? null : user.id))}
                      aria-expanded={isMenuOpen}
                      aria-haspopup="menu"
                      aria-label={`Actions for ${name}`}
                      className={`p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-[#64748B] hover:text-[#171923] hover:bg-[#F1F5F9] rounded-lg transition ${styles.focusable}`}
                    >
                      <MoreVertical className="w-4 h-4" aria-hidden="true" />
                    </button>

                    {isMenuOpen && (
                      <div
                        role="menu"
                        className={`absolute right-0 bottom-full mb-1 w-48 z-40 bg-white rounded-xl border border-[#E8EAF0] ${styles.popoverShadow} py-1 animate-in fade-in zoom-in-95 duration-100`}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            navigator.clipboard?.writeText(user.id);
                            showToast('User ID copied');
                            setActiveMenuId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-[#171923] hover:bg-[#F8F9FC]"
                        >
                          <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                          <span>Copy user ID</span>
                        </button>

                        {user.email && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              navigator.clipboard?.writeText(user.email || '');
                              showToast('Email address copied');
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-[#171923] hover:bg-[#F8F9FC]"
                          >
                            <Mail className="w-3.5 h-3.5 text-[#64748B]" />
                            <span>Copy email</span>
                          </button>
                        )}

                        {phone && (
                          <a
                            href={`https://wa.me/91${String(phone).replace(/\D/g, '').slice(-10)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            role="menuitem"
                            className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-[#171923] hover:bg-[#F8F9FC]"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {sortedUsers.length === 0 && (
          <div className="text-center py-14 px-4">
            <div className="w-12 h-12 rounded-full bg-[#F3E8FF] text-[#7C3AED] flex items-center justify-center mx-auto mb-3">
              <UserIcon className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-[15px] font-semibold text-[#171923]">No registered users found</h3>
            <p className="mt-1 text-[13px] text-[#64748B] max-w-sm mx-auto">
              {searchTerm || hasActiveAdvancedFilters
                ? 'No customers match the current search or filter criteria. Try adjusting or clearing your filters.'
                : 'No users have registered on the platform yet.'}
            </p>
            {(searchTerm || hasActiveAdvancedFilters || chipFilter !== 'all') && (
              <button
                type="button"
                onClick={resetAllFilters}
                className={`mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-[#7C3AED] border border-[#DDD6FE] hover:bg-[#F3E8FF]/30 rounded-xl text-[13px] font-medium transition ${styles.focusable}`}
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset all filters</span>
              </button>
            )}
          </div>
        )}

        {/* Pagination Section */}
        {showPagination && sortedUsers.length > 0 && (
          <nav
            aria-label="Users pagination"
            className="flex flex-col sm:flex-row gap-3 items-center justify-between px-5 py-3.5 border-t border-[#E8EAF0] bg-white"
          >
            {/* Info text */}
            <p className="text-[13px] text-[#64748B]">
              Showing{' '}
              <span className="font-semibold text-[#171923]">{pageStartIndex + 1}</span>–
              <span className="font-semibold text-[#171923]">
                {Math.min(pageStartIndex + PAGE_SIZE, sortedUsers.length)}
              </span>{' '}
              of <span className="font-semibold text-[#171923]">{sortedUsers.length}</span> users
            </p>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5">
              {/* Previous Page Button */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                aria-label="Go to previous page"
                className={`inline-flex items-center justify-center h-8 px-2.5 text-[12px] font-medium rounded-lg border transition ${
                  safePage === 1
                    ? 'border-[#E8EAF0] text-[#CBD5E1] cursor-not-allowed bg-[#F8F9FC]'
                    : 'border-[#E8EAF0] text-[#171923] hover:border-[#7C3AED] hover:text-[#7C3AED] bg-white'
                } ${styles.focusable}`}
              >
                <ChevronLeft className="w-4 h-4 mr-1" aria-hidden="true" />
                <span>Previous</span>
              </button>

              {/* Page Number Buttons */}
              <div className="flex items-center gap-1">
                {paginationRange.map((pageItem, idx) => {
                  if (typeof pageItem === 'string') {
                    return (
                      <span
                        key={`ellipsis-${idx}`}
                        className="w-8 text-center text-[12px] text-[#94A3B8]"
                      >
                        …
                      </span>
                    );
                  }

                  const isCurrent = safePage === pageItem;
                  return (
                    <button
                      key={pageItem}
                      type="button"
                      onClick={() => setCurrentPage(pageItem)}
                      aria-current={isCurrent ? 'page' : undefined}
                      aria-label={`Page ${pageItem}`}
                      className={`min-w-[32px] h-8 px-2 text-[12px] font-medium rounded-lg transition ${
                        isCurrent
                          ? 'bg-[#7C3AED] text-white font-semibold shadow-sm'
                          : 'bg-white text-[#64748B] hover:text-[#171923] hover:bg-[#F8F9FC] border border-[#E8EAF0]'
                      } ${styles.focusable}`}
                    >
                      {pageItem}
                    </button>
                  );
                })}
              </div>

              {/* Next Page Button */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                aria-label="Go to next page"
                className={`inline-flex items-center justify-center h-8 px-2.5 text-[12px] font-medium rounded-lg border transition ${
                  safePage === totalPages
                    ? 'border-[#E8EAF0] text-[#CBD5E1] cursor-not-allowed bg-[#F8F9FC]'
                    : 'border-[#E8EAF0] text-[#171923] hover:border-[#7C3AED] hover:text-[#7C3AED] bg-white'
                } ${styles.focusable}`}
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 ml-1" aria-hidden="true" />
              </button>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
