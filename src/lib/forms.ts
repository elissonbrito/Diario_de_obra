/** Converte "1.234,5" ou "1234.5" em número. Retorna NaN se não for número. */
export function parseNumero(texto: string): number {
  const t = texto.trim()
  if (!t) return NaN
  // com vírgula: ponto é separador de milhar ("1.234,5"); sem vírgula: ponto é decimal ("1234.5")
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  return Number(normal)
}
