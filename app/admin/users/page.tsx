'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, Calendar, CheckCircle, XCircle, Shield } from 'lucide-react';

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 30000);
    return () => clearInterval(interval);
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
    user.phone?.includes(searchTerm)
  );

  const verifiedCount = users.filter(u => u.email_verified).length;
  const adminCount = users.filter(u => u.role === 'admin').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
          <p className="mt-4 text-lg text-purple-600 tracking-wide font-medium">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-2">All Users</h1>
          <p className="text-sm text-gray-600">Manage registered users ({users.length} total)</p>
        </div>
        <div className="flex gap-3">
          <div className="stat-card neon-card rounded-xl border-2 border-purple-200 p-3">
            <p className="text-xs text-gray-600 mb-1">Verified</p>
            <p className="text-xl font-bold text-green-600">{verifiedCount}</p>
          </div>
          <div className="stat-card neon-card rounded-xl border-2 border-purple-200 p-3">
            <p className="text-xs text-gray-600 mb-1">Admins</p>
            <p className="text-xl font-bold text-purple-600">{adminCount}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="neon-card rounded-xl border-2 border-purple-200 p-4">
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 border-2 border-purple-200 rounded-lg focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all"
        />
      </div>

      {/* Users Table */}
      <div className="neon-card rounded-2xl border-2 border-purple-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-2 border-purple-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-100">
              {filteredUsers.map((user, index) => (
                <tr 
                  key={user.id} 
                  className="hover:bg-purple-50 transition-colors animate-fade-in-up cursor-pointer"
                  style={{ animationDelay: `${index * 0.05}s` }}
                  onClick={() => router.push(`/admin/users/${user.id}`)}
                >
                  <td className="px-6 py-4">
                    <Link 
                      href={`/admin/users/${user.id}`}
                      className="flex items-center hover:text-purple-600 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {user.full_name || (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : 'N/A')}
                        </div>
                        {user.first_name && user.last_name && user.full_name && (
                          <div className="text-xs text-gray-500">{user.first_name} {user.last_name}</div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4" onClick={() => router.push(`/admin/users/${user.id}`)}>
                    <div className="flex items-center text-gray-700">
                      <Mail className="h-4 w-4 mr-2 text-purple-600" />
                      {user.email || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4" onClick={() => router.push(`/admin/users/${user.id}`)}>
                    {user.phone ? (
                      <div className="flex items-center text-gray-700">
                        <Phone className="h-4 w-4 mr-2 text-purple-600" />
                        {user.phone}
                      </div>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4" onClick={() => router.push(`/admin/users/${user.id}`)}>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border-2 ${
                      user.role === 'admin'
                        ? 'bg-purple-100 text-purple-700 border-purple-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}>
                      {user.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                      {user.role || 'user'}
                    </span>
                  </td>
                  <td className="px-6 py-4" onClick={() => router.push(`/admin/users/${user.id}`)}>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border-2 ${
                      user.email_verified
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                    }`}>
                      {user.email_verified ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {user.email_verified ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600" onClick={() => router.push(`/admin/users/${user.id}`)}>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    }) : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
}
