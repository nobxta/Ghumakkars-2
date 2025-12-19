'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { User, Calendar, Settings, Gift, Wallet, ArrowRight, Mail, Phone, MapPin } from 'lucide-react';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/signin');
        return;
      }
      setUser(user);

      // Fetch profile data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(profileData);
      setLoading(false);
    };

    getUser();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-600 border-t-transparent"></div>
      </div>
    );
  }

  const menuItems = [
    { href: '/bookings', icon: Calendar, title: 'Recent Bookings', description: 'View your trip bookings', color: 'bg-purple-100 text-purple-600' },
    { href: '/profile/edit', icon: Settings, title: 'Edit Profile', description: 'Update your information', color: 'bg-blue-100 text-blue-600' },
    { href: '/referral', icon: Gift, title: 'Referral System', description: 'Invite friends and earn rewards', color: 'bg-green-100 text-green-600' },
    { href: '/wallet', icon: Wallet, title: 'Wallet', description: 'Manage your credits and payments', color: 'bg-orange-100 text-orange-600' },
  ];

  return (
    <div className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6 md:p-8 mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profile"
                className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-purple-200"
              />
            ) : (
              <div className="w-24 h-24 md:w-32 md:h-32 bg-purple-600 rounded-full flex items-center justify-center">
                <User className="h-12 w-12 md:h-16 md:w-16 text-white" />
              </div>
            )}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-light text-gray-900 mb-2">
                {profile?.full_name || user.user_metadata?.full_name || 'User'}
              </h1>
              <div className="space-y-2">
                {profile?.email && (
                  <div className="flex items-center justify-center md:justify-start space-x-2 text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span className="text-sm">{profile.email}</span>
                  </div>
                )}
                {profile?.phone && (
                  <div className="flex items-center justify-center md:justify-start space-x-2 text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm">{profile.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white rounded-xl border-2 border-purple-100 p-6 hover:border-purple-300 hover:shadow-lg transition-all duration-200 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className={`${item.color} p-3 rounded-lg group-hover:scale-110 transition-transform`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{item.title}</h3>
                      <p className="text-sm text-gray-600">{item.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

