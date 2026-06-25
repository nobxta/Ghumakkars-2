'use client';

import { Check } from 'lucide-react';

/**
 * "What Happens Next" — a compact 3-step vertical tracker used by the
 * verification-pending states. Step 1 is done, step 2 is active, step 3 is upcoming.
 */
export default function NextSteps({ accent }: { accent: string }) {
  const steps = [
    { label: 'Payment Received', state: 'done' as const },
    { label: 'Team verifies payment', state: 'active' as const },
    { label: 'Confirmation sent', state: 'todo' as const },
  ];

  return (
    <div className="pt-2">
      <h4 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#414754]">What happens next</h4>
      <div className="flex gap-4">
        {/* Rail */}
        <div className="flex flex-col items-center">
          {steps.map((s, i) => (
            <div key={s.label} className="flex flex-col items-center">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold"
                style={
                  s.state === 'todo'
                    ? { background: '#e6e8f2', color: '#727785' }
                    : { background: accent, color: '#fff' }
                }
              >
                {s.state === 'done' ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className="h-6 w-0.5" style={{ background: s.state === 'done' ? `${accent}40` : '#e0e2ec' }} />
              )}
            </div>
          ))}
        </div>
        {/* Labels */}
        <div className="flex flex-1 flex-col justify-between py-1">
          {steps.map((s) => (
            <div
              key={s.label}
              className={`text-sm ${s.state === 'active' ? 'font-bold text-[#191b23]' : 'text-[#414754]'}`}
            >
              {s.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
