const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID!;
const CF_API_TOKEN = process.env.CF_API_TOKEN!;

async function kvGet(namespaceId: string, key: string): Promise<string | null> {
  const encodedKey = encodeURIComponent(key);
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${namespaceId}/values/${encodedKey}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  return res.text();
}

function normalize(word: string): string {
  return word.toLowerCase().normalize("NFC");
}

function accentless(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC");
}

function getPrefix(word: string): string {
  return word.slice(0, 2);
}

async function reverseItLookup(wordForm: string): Promise<string[]> {
  const nsId = process.env.CF_KV_NS_REVERSE_IT!;
  const strategies = [
    { prefix: "it:rev:v2:surface:", form: wordForm },
    { prefix: "it:rev:v2:norm:", form: normalize(wordForm) },
    { prefix: "it:rev:v2:accentless:", form: accentless(wordForm) },
  ];
  for (const { prefix, form } of strategies) {
    const shardKey = `${prefix}${getPrefix(form)}`;
    const raw = await kvGet(nsId, shardKey);
    if (!raw) continue;
    const shard = JSON.parse(raw) as Record<string, string[]>;
    if (shard[form]) return shard[form];
  }
  return [];
}

async function getVerbData(infinitive: string): Promise<Record<string, unknown> | null> {
  const raw = await kvGet(process.env.CF_KV_NS_VERB_IT!, `verb:${infinitive}`);
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function lookupConjugation(
  wordForm: string,
  language: string
): Promise<{ infinitive: string; conjugationTable: Record<string, unknown> } | null> {
  if (language !== "IT") return null;
  const candidates = await reverseItLookup(wordForm);
  if (candidates.length === 0) return null;
  const infinitive = candidates[0];
  const conjugationTable = await getVerbData(infinitive);
  if (!conjugationTable) return null;
  return { infinitive, conjugationTable };
}
