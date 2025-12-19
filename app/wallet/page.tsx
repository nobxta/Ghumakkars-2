'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Wallet, Plus, Minus, ArrowUpRight, ArrowDownRight, CreditCard } from 'lucide-react';

export default function WalletPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.push('/auth/signin');
        return;
      }
      setUser(currentUser);

      // Fetch profile with wallet balance
      const { data: profileData } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', currentUser.id)
        .single();
      
      setProfile(profileData);

      // Fetch wallet transactions
      const { data: transactionsData } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setTransactions(transactionsData || []);
      setLoading(false);
    };

    fetchData();
  }, [router, supabase]);

  const walletBalance = profile?.wallet_balance || 0;

  if (loading) {
    return (
      <div className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Link href="/profile" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-6 md:mb-8 text-sm font-medium transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span>Back to Profile</span>
        </Link>

        {/* Wallet Balance Card */}
        <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 rounded-2xl shadow-xl p-6 md:p-8 mb-6 text-white">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Wallet className="h-6 w-6 md:h-8 md:w-8" />
              <h1 className="text-xl md:text-2xl font-light">My Wallet</h1>
            </div>
            <CreditCard className="h-8 w-8 md:h-10 md:w-10 opacity-80" />
          </div>
          
          <div className="mb-6">
            <p className="text-purple-200 text-sm mb-2">Available Balance</p>
            <div className="text-4xl md:text-5xl font-light">₹{walletBalance.toLocaleString()}</div>
          </div>

          <div className="flex space-x-4">
            <button className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center justify-center space-x-2 transition-colors">
              <Plus className="h-5 w-5" />
              <span className="font-medium">Add Money</span>
            </button>
            <button className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center justify-center space-x-2 transition-colors">
              <Minus className="h-5 w-5" />
              <span className="font-medium">Withdraw</span>
            </button>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-6">Transaction History</h2>

          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No transactions yet</h3>
              <p className="text-gray-600 mb-6">Your transaction history will appear here</p>
              <button className="inline-flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors">
                <Plus className="h-4 w-4" />
                <span>Add Money</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border-2 border-purple-100 rounded-lg hover:border-purple-300 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-lg ${
                      transaction.type === 'credit' 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {transaction.type === 'credit' ? (
                        <ArrowDownRight className="h-5 w-5" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{transaction.description}</h3>
                      <p className="text-sm text-gray-500">{new Date(transaction.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className={`text-lg font-semibold ${
                    transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

