import "server-only";

type AirtableRecord = {
  fields: Record<string, string | number | boolean>;
};

function configuration() {
  const token = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  return token && baseId ? { token, baseId } : null;
}

export function airtableAvailable(): boolean {
  return Boolean(configuration());
}

export async function upsertAirtableRecords(
  table: string,
  records: AirtableRecord[],
): Promise<number> {
  const config = configuration();
  if (!config) throw new Error("Airtable is not configured.");
  let synced = 0;
  for (let index = 0; index < records.length; index += 10) {
    const batch = records.slice(index, index + 10);
    const response = await fetch(
      `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(table)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          performUpsert: { fieldsToMergeOn: ["External ID"] },
          records: batch,
          typecast: true,
        }),
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Airtable sync failed for ${table}: ${response.status} ${detail.slice(0, 180)}`);
    }
    synced += batch.length;
  }
  return synced;
}

export async function getAirtableRecords(
  table: string,
  options: { maxRecords?: number; filterByFormula?: string } = {},
): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const config = configuration();
  if (!config) throw new Error("Airtable is not configured.");
  const params = new URLSearchParams();
  if (options.maxRecords) params.set("maxRecords", String(options.maxRecords));
  if (options.filterByFormula) params.set("filterByFormula", options.filterByFormula);
  const response = await fetch(
    `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(table)}?${params}`,
    { headers: { Authorization: `Bearer ${config.token}` }, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Airtable read failed for ${table}.`);
  const payload = (await response.json()) as {
    records?: Array<{ id: string; fields: Record<string, unknown> }>;
  };
  return payload.records || [];
}
