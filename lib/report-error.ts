/**
 * Send a browser-side failure to the admin Error Logs page. Fire-and-forget:
 * never throws and never blocks the UI.
 */
export function reportClientError(report: {
  category: 'payment' | 'booking' | 'auth' | 'otp' | 'system';
  process: string;
  message: string;
  code?: string | number | null;
  bookingId?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    fetch('/api/error-logs/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...report,
        details: {
          ...report.details,
          page: window.location.pathname,
          screen: `${window.screen.width}x${window.screen.height}`,
          online: navigator.onLine,
        },
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}
