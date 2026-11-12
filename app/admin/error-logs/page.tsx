'use client';

import { useCallback, useEffect, useState } from 'react';
import ErrorLogsView, { type ErrorLog } from '@/components/admin/ErrorLogsView';

const AUTO_REFRESH_MS = 60_000;

export default function AdminErrorLogsPage() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchLogs = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/admin/error-logs', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch logs');
      const { logs } = await response.json();
      setLogs(logs || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchLogs();
    }, AUTO_REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && fetchLogs();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchLogs]);

  const setResolved = async (ids: string[], resolved: boolean) => {
    const idSet = new Set(ids);
    setLogs((prev) => prev.map((l) => (idSet.has(l.id) ? { ...l, resolved } : l)));
    const response = await fetch('/api/admin/error-logs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, resolved }),
    });
    if (!response.ok) fetchLogs();
  };

  const resolveAll = async () => {
    if (!confirm('Mark every open log as fixed?')) return;
    setLogs((prev) => prev.map((l) => ({ ...l, resolved: true })));
    await fetch('/api/admin/error-logs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true, resolved: true }),
    });
    fetchLogs();
  };

  const clear = async (scope: 'resolved' | 'routine' | 'all', question: string, keep: (l: ErrorLog) => boolean) => {
    if (!confirm(question)) return;
    setLogs((prev) => prev.filter(keep));
    await fetch(`/api/admin/error-logs?scope=${scope}`, { method: 'DELETE' });
    fetchLogs();
  };

  return (
    <ErrorLogsView
      logs={logs}
      loading={loading}
      refreshing={refreshing}
      lastUpdated={lastUpdated}
      onRefresh={fetchLogs}
      onSetResolved={setResolved}
      onResolveAll={resolveAll}
      onClearResolved={() => clear('resolved', 'Delete all fixed logs? This cannot be undone.', (l) => !l.resolved)}
      onClearRoutine={() => clear('routine', 'Delete all routine activity (typos, wrong OTPs, incomplete forms)? This cannot be undone.', (l) => l.level !== 'warning')}
      onClearAll={() => clear('all', 'Delete EVERY log, including open problems? This cannot be undone.', () => false)}
    />
  );
}
