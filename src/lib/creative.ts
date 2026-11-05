// Lectura del código de creativo en el nombre del anuncio.
// Patrón por defecto: OFERTA + TANDA . G(gancho) . C(copy) . F(formato) — ej: AT08.G2.C1.F1

export interface CreativeCode {
  code: string;
  offerCode: string;
  batch: string;
  hook: number;
  copy: number;
  format: number;
}

const PATTERN = /\b([A-Z]{2,4})(\d{2,3})\.G(\d+)\.C(\d+)\.F(\d+)\b/i;

export function parseCreativeCode(name: string): CreativeCode | null {
  const m = PATTERN.exec(name);
  if (!m) return null;
  const offerCode = m[1].toUpperCase();
  return {
    code: `${offerCode}${m[2]}.G${m[3]}.C${m[4]}.F${m[5]}`,
    offerCode,
    batch: m[2],
    hook: Number(m[3]),
    copy: Number(m[4]),
    format: Number(m[5]),
  };
}

/** Código de oferta a partir del nombre del anuncio o de la campaña (las letras iniciales). */
export function offerCodeFromName(name: string): string | null {
  const c = parseCreativeCode(name);
  if (c) return c.offerCode;
  const m = /^\s*\[?([A-Z]{2,4})\d{0,3}\b/i.exec(name);
  return m ? m[1].toUpperCase() : null;
}
