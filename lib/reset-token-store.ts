// In-memory reset token store (for production, use Redis or database)
interface ResetTokenEntry {
  email: string;
  expiresAt: number;
}

const resetTokens = new Map<string, ResetTokenEntry>();

// Clean up expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of Array.from(resetTokens.entries())) {
    if (entry.expiresAt < now) {
      resetTokens.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function storeResetToken(token: string, email: string, expiresInMinutes: number = 60): void {
  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
  resetTokens.set(token, {
    email: email.toLowerCase(),
    expiresAt,
  });
}

export function getResetTokenEmail(token: string): string | null {
  const entry = resetTokens.get(token);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    resetTokens.delete(token);
    return null;
  }

  return entry.email;
}

export function removeResetToken(token: string): void {
  resetTokens.delete(token);
}

