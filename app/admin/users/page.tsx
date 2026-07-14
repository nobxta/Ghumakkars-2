'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, User } from 'lucide-react';

const PAGE_SIZE = 20;

function getUserName(user: any) {
  return user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || 'N/A';
}

function getInitials(name: string) {
  if (!name || name === 'N/A') return 'NA';

  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : parts[0].slice(0, 2);

  return initials.toUpperCase();
}

function formatRegistrationDate(date: string | null | undefined) {
  if (!date) return 'N/A';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const { users } = await response.json();
      setUsers(users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone?.includes(searchTerm)
  );

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedUsers = filteredUsers.slice(pageStartIndex, pageStartIndex + PAGE_SIZE);
  const showPagination = filteredUsers.length > PAGE_SIZE;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-[#F7F8FC]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#E7E8EE] border-t-[#8758F6] mx-auto"></div>
          <p className="mt-4 text-sm text-[#666873] font-medium">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 sm:-m-6 min-h-[calc(100vh-4rem)] bg-[#F7F8FC] p-4 sm:p-8 animate-fade-in-up">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[30px] font-bold leading-tight tracking-tight text-[#17171C]">Registered Users</h1>
          <p className="mt-1 text-sm text-[#666873]">View all users registered on Ghumakkars</p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-[#E7E8EE] bg-white px-3 py-1 text-sm font-semibold text-[#17171C] shadow-[0_1px_2px_rgba(23,23,28,0.04)]">
          {users.length} users
        </span>
      </div>

      <div className="relative mb-4 w-full max-w-[520px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666873]" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-11 w-full rounded-xl border border-[#E7E8EE] bg-white pl-10 pr-4 text-sm text-[#17171C] outline-none transition placeholder:text-[#8A8C96] focus:border-[#8758F6] focus:ring-4 focus:ring-[#8758F6]/10"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E7E8EE] bg-white shadow-[0_10px_30px_rgba(23,23,28,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed">
            <colgroup>
              <col className="w-[25%]" />
              <col className="w-[37%]" />
              <col className="w-[20%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-[#E7E8EE] bg-[#FAFAFD]">
              <tr className="h-[46px]">
                <th className="px-5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#666873]">User</th>
                <th className="px-5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#666873]">Email</th>
                <th className="px-5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#666873]">Phone</th>
                <th className="px-5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#666873]">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E8EE]">
              {paginatedUsers.map((user, index) => {
                const name = getUserName(user);

                return (
                  <tr 
                    key={user.id} 
                    className="h-[62px] cursor-pointer transition-colors hover:bg-[#FAF7FF]"
                    style={{ animationDelay: `${index * 0.05}s` }}
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                  >
                    <td className="px-5 py-2">
                      <Link 
                        href={`/admin/users/${user.id}`}
                        className="flex min-w-0 items-center gap-3 transition-colors hover:text-[#8758F6]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F1EBFF] text-xs font-bold text-[#8758F6]">
                          {getInitials(name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate whitespace-nowrap text-sm font-semibold text-[#17171C]">{name}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-2">
                      <div className="truncate whitespace-nowrap text-sm text-[#17171C]">{user.email || 'N/A'}</div>
                    </td>
                    <td className="px-5 py-2">
                      <div className="truncate whitespace-nowrap text-sm text-[#17171C]">{user.phone || 'N/A'}</div>
                    </td>
                    <td className="px-5 py-2">
                      <div className="truncate whitespace-nowrap text-sm text-[#17171C]">{formatRegistrationDate(user.created_at)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <User className="h-10 w-10 text-[#C6C8D0] mx-auto mb-3" />
            <p className="text-sm text-[#666873]">No users found</p>
          </div>
        )}
        {showPagination && (
          <div className="flex flex-col gap-3 border-t border-[#E7E8EE] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#666873]">
              Showing {pageStartIndex + 1}-{Math.min(pageStartIndex + PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safePage === 1}
                className="rounded-lg border border-[#E7E8EE] bg-white px-3 py-2 text-sm font-medium text-[#17171C] transition hover:border-[#8758F6] hover:text-[#8758F6] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-[#E7E8EE] disabled:hover:text-[#17171C]"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safePage === totalPages}
                className="rounded-lg border border-[#E7E8EE] bg-white px-3 py-2 text-sm font-medium text-[#17171C] transition hover:border-[#8758F6] hover:text-[#8758F6] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-[#E7E8EE] disabled:hover:text-[#17171C]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
