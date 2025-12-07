import { createHmac } from 'crypto';

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const getSecret = () => {
  const secret = process.env.STAFF_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('Missing STAFF_CODE_SECRET (or SUPABASE_SERVICE_ROLE_KEY) for staff join codes.');
  }
  return secret;
};

const getWindow = (timestamp = Date.now()) => Math.floor(timestamp / WINDOW_MS);

export const getCodeExpiry = (timestamp = Date.now()) => {
  const windowStart = getWindow(timestamp) * WINDOW_MS;
  return windowStart + WINDOW_MS;
};

export const generateStaffCode = (storeId: string, timestamp = Date.now()) => {
  const secret = getSecret();
  const window = getWindow(timestamp);
  const digest = createHmac('sha256', secret)
    .update(`${storeId}:${window}`)
    .digest('hex');

  // 6-digit code derived from the hash
  const code = (parseInt(digest.slice(0, 8), 16) % 1_000_000).toString().padStart(6, '0');
  return code;
};

export const verifyStaffCode = (storeId: string, code: string, timestamp = Date.now()) => {
  const trimmed = code.trim();
  if (!storeId || !trimmed) return { valid: false, expiresAt: getCodeExpiry(timestamp) };

  const currentWindow = getWindow(timestamp);
  const windowsToCheck = [currentWindow, currentWindow - 1]; // allow a 10-minute grace window for clock drift

  for (const window of windowsToCheck) {
    const digest = createHmac('sha256', getSecret())
      .update(`${storeId}:${window}`)
      .digest('hex');
    const candidate = (parseInt(digest.slice(0, 8), 16) % 1_000_000).toString().padStart(6, '0');
    if (candidate === trimmed) {
      const expiresAt = (window + 1) * WINDOW_MS;
      return { valid: true, expiresAt };
    }
  }

  return { valid: false, expiresAt: getCodeExpiry(timestamp) };
};
