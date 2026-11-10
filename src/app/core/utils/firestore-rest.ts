/**
 * Leitura direta da API REST do Firestore, para o único caso que os SDKs web
 * não cobrem: buscar só alguns campos de cada documento (projeção `select`).
 * É a mesma leitura anônima que o site já faz (as regras do Firestore valem igual).
 */

type RestValue = Record<string, unknown>;

/** Converte um Value do Firestore REST em valor JS (timestamps viram Date). */
export function decodeRestValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as RestValue;
  if ('stringValue' in v) return v['stringValue'];
  if ('timestampValue' in v) return new Date(String(v['timestampValue']));
  if ('integerValue' in v) return Number(v['integerValue']);
  if ('doubleValue' in v) return Number(v['doubleValue']);
  if ('booleanValue' in v) return Boolean(v['booleanValue']);
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) {
    const values = (v['arrayValue'] as { values?: unknown[] })?.values || [];
    return values.map(decodeRestValue);
  }
  if ('mapValue' in v) {
    return decodeRestFields((v['mapValue'] as { fields?: Record<string, unknown> })?.fields || {});
  }
  if ('referenceValue' in v) return v['referenceValue'];
  if ('geoPointValue' in v) return v['geoPointValue'];
  return undefined;
}

export function decodeRestFields(fields: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields || {})) {
    result[key] = decodeRestValue(value);
  }
  return result;
}

/**
 * Lê todos os documentos de uma coleção trazendo só `fields`. Devolve
 * [id do documento, dados] para cada um. Lança erro se a API responder com
 * falha, para quem chama decidir o fallback.
 */
export async function runSelectQuery(
  projectId: string,
  collectionId: string,
  fields: readonly string[]
): Promise<Array<[string, Record<string, unknown>]>> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        select: { fields: fields.map(fieldPath => ({ fieldPath })) }
      }
    })
  });
  if (!response.ok) {
    throw new Error(`Firestore REST respondeu ${response.status} ao ler ${collectionId}.`);
  }

  const rows = await response.json() as Array<{ document?: { name: string; fields?: Record<string, unknown> } }>;
  return rows
    .filter(row => !!row.document)
    .map(row => [row.document!.name.split('/').pop() || '', decodeRestFields(row.document!.fields || {})]);
}
