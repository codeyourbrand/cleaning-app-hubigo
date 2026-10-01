/**
 * Hostfully API v3 client.
 * Authentication: X-HOSTFULLY-APIKEY header.
 * Docs: https://dev.hostfully.com
 */

export interface HostfullyProperty {
  uid: string;
  name?: string;
  internalName?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  description?: string;
}

export interface HostfullyLead {
  uid: string;
  propertyUid?: string;
  status?: string;
  arrivalDate?: string; // ISO date
  departureDate?: string; // ISO date
  arrivalTime?: string;
  departureTime?: string;
  numAdults?: number;
  numChildren?: number;
  numInfants?: number;
  numPets?: number;
  guest?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  notes?: string;
  specialRequests?: string;
  externalId?: string;
  dateOfInquiry?: string;
  dateCreated?: string;
  dateUpdated?: string;
}

export interface HostfullyWebhookPayload {
  agency_uid: string;
  event_type: string;
  property_uid?: string;
  lead_uid?: string;
  pincode_uid?: string;
}

const API_BASE = process.env.HOSTFULLY_API_BASE_URL?.replace(/\/$/, "") ?? "https://api.hostfully.com/v2";

function getHeaders() {
  const key = process.env.HOSTFULLY_API_KEY;
  if (!key) throw new Error("HOSTFULLY_API_KEY is not configured");
  return {
    "Content-Type": "application/json",
    "X-HOSTFULLY-APIKEY": key,
  };
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...getHeaders(), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`Hostfully API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getProperties(): Promise<HostfullyProperty[]> {
  return fetchJson<HostfullyProperty[]>("/properties");
}

export async function getProperty(uid: string): Promise<HostfullyProperty | null> {
  try {
    return await fetchJson<HostfullyProperty>(`/properties/${uid}`);
  } catch (err: any) {
    if (err.message?.includes("404")) return null;
    throw err;
  }
}

export async function getLeads(since?: Date): Promise<HostfullyLead[]> {
  const params = new URLSearchParams();
  if (since) {
    params.set("dateUpdatedFrom", since.toISOString().split("T")[0]);
  }
  const qs = params.toString() ? `?${params.toString()}` : "";
  return fetchJson<HostfullyLead[]>(`/leads${qs}`);
}

export async function getLead(uid: string): Promise<HostfullyLead | null> {
  try {
    return await fetchJson<HostfullyLead>(`/leads/${uid}`);
  } catch (err: any) {
    if (err.message?.includes("404")) return null;
    throw err;
  }
}

export interface WebhookInput {
  url: string;
  eventTypes: string[];
  objectType?: "PROPERTY" | "AGENCY" | "LEAD";
  objectUid?: string;
}

export async function listWebhooks(): Promise<unknown[]> {
  return fetchJson<unknown[]>("/webhooks");
}

export async function createWebhook(input: WebhookInput): Promise<unknown> {
  return fetchJson<unknown>("/webhooks", {
    method: "POST",
    body: JSON.stringify({
      url: input.url,
      webhookType: input.eventTypes,
      objectTypeEnum: input.objectType ?? "AGENCY",
      objectUid: input.objectUid,
    }),
  });
}

export async function deleteWebhook(uid: string): Promise<void> {
  await fetchJson(`/webhooks/${uid}`, { method: "DELETE" });
}
