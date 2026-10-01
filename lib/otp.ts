import twilio from "twilio";

interface OtpEntry {
  code: string;
  expiresAt: number;
}

const otpStore = new Map<string, OtpEntry>();
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEV_CODE = "000000";

function key(identifier: string): string {
  return `otp:${identifier}`;
}

export async function sendOtp(identifier: string): Promise<{ code?: string; sent: boolean }> {
  const code = generateCode();
  otpStore.set(key(identifier), { code, expiresAt: Date.now() + OTP_TTL_MS });

  if (process.env.NODE_ENV !== "production") {
    return { code, sent: true };
  }

  if (identifier.startsWith("+") || /^\d+$/.test(identifier)) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (sid && token && from) {
      const client = twilio(sid, token);
      await client.messages.create({
        body: `Your Hubigo code is ${code}`,
        from,
        to: identifier,
      });
      return { sent: true };
    }
  }

  // Production without SMS provider is unsupported
  return { sent: false };
}

export function verifyOtp(identifier: string, code: string): boolean {
  const entry = otpStore.get(key(identifier));
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key(identifier));
    return false;
  }
  if (entry.code !== code) return false;
  otpStore.delete(key(identifier));
  return true;
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
