import { fetchJson, previewStatus, type ActionResult, type Lead, type Mode } from "./types";

const BASE = "https://api.hubapi.com";

function splitName(name: string | null | undefined): { firstname: string; lastname: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstname: "Unknown caller", lastname: "" };
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

export async function createContactAndDeal(mode: Mode, lead: Lead): Promise<ActionResult> {
  const f = lead.fields;
  const phone = lead.phone ?? f?.phone ?? "";
  const { firstname, lastname } = splitName(f?.name);
  const dealName = `${f?.name ?? "Caller"}: ${[f?.scope, f?.location].filter(Boolean).join(", ") || "interior design enquiry"}`.slice(0, 200);
  const dealDescription = [lead.summary, lead.uncertain.length ? `Uncertain: ${lead.uncertain.join("; ")}` : "", lead.askedAboutPrice ? "Asked about price (no figure quoted)." : "", `Call: ${lead.dashboardUrl}`]
    .filter(Boolean)
    .join("\n\n");
  const preview = { contact: { firstname, lastname, phone, city: f?.location }, deal: { dealname: dealName, description: dealDescription } };
  if (mode !== "live") return { channel: "hubspot", status: previewStatus(mode), detail: preview };

  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return { channel: "hubspot", status: "failed", detail: { error: "HUBSPOT_TOKEN missing", ...preview } };
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  try {
    let contactId: string | undefined;
    const c = await fetchJson(`${BASE}/crm/v3/objects/contacts`, {
      method: "POST",
      headers,
      body: JSON.stringify({ properties: { firstname, lastname, phone, city: f?.location ?? undefined, lifecyclestage: "lead" } }),
    });
    if (c.ok) contactId = String(c.json?.id);
    else if (c.status === 409) contactId = String(c.json?.message ?? "").match(/Existing ID:\s*(\d+)/)?.[1];
    if (!contactId) return { channel: "hubspot", status: "failed", detail: { step: "contact", http: c.status, error: c.json?.message ?? c.text.slice(0, 200) } };

    const d = await fetchJson(`${BASE}/crm/v3/objects/deals`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        properties: { dealname: dealName, pipeline: "default", dealstage: "appointmentscheduled", description: dealDescription },
        associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] }],
      }),
    });
    if (!d.ok) return { channel: "hubspot", status: "failed", detail: { step: "deal", contactId, http: d.status, error: d.json?.message ?? d.text.slice(0, 200) } };
    return { channel: "hubspot", status: "sent", detail: { contactId, dealId: d.json?.id }, externalId: String(d.json?.id) };
  } catch (e) {
    return { channel: "hubspot", status: "failed", detail: { error: (e as Error).message } };
  }
}
