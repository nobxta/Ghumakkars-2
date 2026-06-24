'use client';

/**
 * Centered auth layout (light theme): a single clean card on a soft background.
 * Reused by sign-in, sign-up, forgot-password, etc.
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100svh] w-full flex items-center justify-center bg-[#FAFAFC] px-5 py-10 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -left-24 w-[440px] h-[440px] rounded-full bg-purple-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 w-[440px] h-[440px] rounded-full bg-fuchsia-200/30 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-[24px] bg-white border border-[#E8E8EF] shadow-[0_10px_40px_rgba(15,23,42,0.06)] p-7 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
