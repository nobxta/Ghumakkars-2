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
      if (!response.ok) throw new Error('Failed to fetch error logs');
      const { logs } = await response.json();
      setLogs(logs || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching error logs:', error);
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
    return () => clearInterval(timer);
  }, [fetchLogs]);

  const setResolved = async (id: string, resolved: boolean) => {
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, resolved } : l)));
    const response = await fetch('/api/admin/error-logs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, resolved }),
    });
    if (!response.ok) fetchLogs();
  };

  const resolveAll = async () => {
    if (!confirm('Mark every open log as resolved?')) return;
    setLogs((prev) => prev.map((l) => ({ ...l, resolved: true })));
    await fetch('/api/admin/error-logs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true, resolved: true }),
    });
    fetchLogs();
  };

  const clearResolved = async () => {
    if (!confirm('Delete all resolved logs? This cannot be undone.')) return;
    setLogs((prev) => prev.filter((l) => !l.resolved));
    await fetch('/api/admin/error-logs?scope=resolved', { method: 'DELETE' });
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
      onClearResolved={clearResolved}
    />
  );
}
