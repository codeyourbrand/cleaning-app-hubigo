/**
 * Hostfully API v3.3 client.
 * Authentication: X-HOSTFULLY-APIKEY header.
 * List endpoints require the agencyUid query param and paginate via
 * _limit / _cursor with a `_paging._nextCursor` in the response.
 * Docs: https://dev.hostfully.com
 */

const DEFAULT_BASE_URL = "https://api.hostfully.com/api/v3.3";
const PAGE_LIMIT = 100;

export interface HostfullyProperty {
  uid: string;
  agencyUid?: string;
  name?: string;
  isActive?: boolean;
  propertyType?: string;
  address?: {
    address?: string;
    address2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    countryCode?: string;
  };
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  availability?: {
    checkInTimeStart?: number;
    checkOutTime?: number;
  };
}

export interface HostfullyLead {
  uid: string;
  propertyUid?: string;
  agencyUid?: string;
  status?: string;
  type?: string;
  checkInZonedDateTime?: string;
  checkOutZonedDateTime?: string;
  checkInLocalDateTime?: string;
  checkOutLocalDateTime?: string;
  notes?: string;
  extraNotes?: string;
  externalBookingId?: string;
  metadata?: {
    createdUtcDateTime?: string;
    updatedUtcDateTime?: string;
  };
  guestInformation?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    adultCount?: number;
    childrenCount?: number;
    petCount?: number;
    infantCount?: number;
  };
}

export interface HostfullyWebhook {
  uid: string;
  agencyUid?: string;
  webhookType?: string;
  eventType?: string;
  callbackUrl?: string;
  objectUid?: string;
  creatorIdentifier?: string;
}

/** Webhook callback payload (POST_JSON, snake_case). No signature header. */
export interface HostfullyWebhookPayload {
  agency_uid: string;
  event_type: string;
  property_uid?: string;
  lead_uid?: string;
  pincode_uid?: string;
}

export const HOSTFULLY_WEBHOOK_EVENT_TYPES = [
  "NEW_BOOKING",
  "BOOKING_UPDATED",
  "BOOKING_CANCELLED",
  "LEAD_DATES_CHANGED",
  "LEAD_PROPERTY_CHANGED",
  "LEAD_SOFT_DELETED",
  "NEW_PROPERTY",
  "UPDATED_PROPERTY",
  "ACTIVATED_PROPERTY",
  "DEACTIVATED_PROPERTY",
  "DELETED_PROPERTY",
] as const;

interface HostfullyConfig {
  apiKey: string;
  agencyUid: string;
  baseUrl: string;
}

function getConfig(): HostfullyConfig {
  const apiKey = process.env.HOSTFULLY_API_KEY;
  const agencyUid = process.env.HOSTFULLY_AGENCY_UID;
  if (!apiKey || !agencyUid) {
    throw new Error(
      "Hostfully is not configured: set HOSTFULLY_API_KEY and HOSTFULLY_AGENCY_UID",
    );
  }
  const baseUrl = (
    process.env.HOSTFULLY_API_BASE_URL ?? DEFAULT_BASE_URL
  ).replace(/\/+$/, "");
  return { apiKey, agencyUid, baseUrl };
}

export function isHostfullyConfigured(): boolean {
  return Boolean(
    process.env.HOSTFULLY_API_KEY && process.env.HOSTFULLY_AGENCY_UID,
  );
}

export class HostfullyApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HostfullyApiError";
  }
}

async function fetchJson<T>(
  path: string,
  init?: RequestInit,
  params?: Record<string, string>,
): Promise<T> {
  const { apiKey, agencyUid, baseUrl } = getConfig();
  const search = new URLSearchParams({ agencyUid, ...params });
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}?${search}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-HOSTFULLY-APIKEY": apiKey,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new HostfullyApiError(
      res.status,
      `Hostfully API ${res.status}: ${text}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

interface PagedResponse {
  _paging?: { _limit?: number; _nextCursor?: string | null };
  _metadata?: { count?: number; totalCount?: number };
}

async function fetchAll<T>(
  path: string,
  key: string,
  params: Record<string, string> = {},
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();
  for (;;) {
    const pageParams: Record<string, string> = {
      ...params,
      _limit: String(PAGE_LIMIT),
    };
    if (cursor) pageParams._cursor = cursor;
    const res = await fetchJson<PagedResponse & Record<string, T[]>>(
      path,
      undefined,
      pageParams,
    );
    const items = res[key];
    if (Array.isArray(items)) out.push(...items);
    const next = res._paging?._nextCursor;
    if (!next || seenCursors.has(next)) break;
    seenCursors.add(next);
    cursor = next;
  }
  return out;
}

export function getProperties(): Promise<HostfullyProperty[]> {
  return fetchAll<HostfullyProperty>("/properties", "properties");
}

export async function getProperty(
  uid: string,
): Promise<HostfullyProperty | null> {
  try {
    const res = await fetchJson<{ property: HostfullyProperty }>(
      `/properties/${uid}`,
    );
    return res.property ?? null;
  } catch (err) {
    if (err instanceof HostfullyApiError && err.status === 404) return null;
    throw err;
  }
}

export function getLeads(since?: Date): Promise<HostfullyLead[]> {
  const params: Record<string, string> = {};
  if (since) {
    // Hostfully expects yyyy-MM-dd'T'HH:mm:ss (UTC)
    params.updatedSince = since.toISOString().slice(0, 19);
  }
  return fetchAll<HostfullyLead>("/leads", "leads", params);
}

export async function getLead(uid: string): Promise<HostfullyLead | null> {
  try {
    const res = await fetchJson<{ lead: HostfullyLead }>(`/leads/${uid}`);
    return res.lead ?? null;
  } catch (err) {
    if (err instanceof HostfullyApiError && err.status === 404) return null;
    throw err;
  }
}

export async function listWebhooks(): Promise<HostfullyWebhook[]> {
  const res = await fetchJson<{ webhooks: HostfullyWebhook[] }>("/webhooks");
  return res.webhooks ?? [];
}

export async function createWebhook(input: {
  eventType: string;
  callbackUrl: string;
}): Promise<HostfullyWebhook> {
  const { agencyUid } = getConfig();
  const res = await fetchJson<{ webhook: HostfullyWebhook }>("/webhooks", {
    method: "POST",
    body: JSON.stringify({
      agencyUid,
      objectUid: agencyUid,
      webhookType: "POST_JSON",
      eventType: input.eventType,
      callbackUrl: input.callbackUrl,
    }),
  });
  return res.webhook;
}

export async function deleteWebhook(uid: string): Promise<void> {
  await fetchJson(`/webhooks/${uid}`, { method: "DELETE" });
}
