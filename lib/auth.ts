import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

const SESSION_COOKIE = "hubigo_session";

if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET must be set in production");
}

const AUTH_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-change-me",
);

export interface SessionPayload {
  userId: string;
  role: Role;
  name: string;
  email?: string | null;
  phone?: string | null;
}

export { hashPassword, verifyPassword } from "./password";

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({
    userId: payload.userId,
    role: payload.role,
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("400d")
    .sign(AUTH_SECRET);

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
}

export async function verifySession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, AUTH_SECRET);
    return {
      userId: String(payload.userId),
      role: payload.role as Role,
      name: String(payload.name),
      email: payload.email ? String(payload.email) : null,
      phone: payload.phone ? String(payload.phone) : null,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

// Simple in-memory rate limiter for auth endpoints.
// In production with multiple instances, use Redis or similar.
interface LimitEntry {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, LimitEntry>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export function checkRateLimit(key: string): {
  ok: boolean;
  retryAfter?: number;
} {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { ok: true };
}
