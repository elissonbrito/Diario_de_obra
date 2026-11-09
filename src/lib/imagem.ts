// Partes puras do tratamento de fotos (sem DOM), testadas em tests/unit.

/** Tamanho final mantendo a proporção: o lado maior fica com no máximo `max` px (nunca amplia). */
export function dimensoesReduzidas(largura: number, altura: number, max: number): { largura: number; altura: number } {
  const maior = Math.max(largura, altura)
  if (maior <= max) return { largura, altura }
  const f = max / maior
  return { largura: Math.max(1, Math.round(largura * f)), altura: Math.max(1, Math.round(altura * f)) }
}

/**
 * Lê a data de captura do EXIF de um JPEG (DateTimeOriginal; se não houver, DateTime).
 * Recebe o começo do arquivo (64 KB bastam). Devolve 'AAAA-MM-DD HH:MM' ou null.
 * Leitor mínimo de propósito, para não trazer uma biblioteca de EXIF inteira.
 */
export function lerDataExif(buf: ArrayBuffer): string | null {
  try {
    const v = new DataView(buf)
    if (v.getUint16(0) !== 0xffd8) return null
    let p = 2
    while (p + 4 <= v.byteLength) {
      const marcador = v.getUint16(p)
      const tam = v.getUint16(p + 2)
      if ((marcador & 0xff00) !== 0xff00) return null
      if (marcador === 0xffda) return null // início da imagem: não há EXIF antes
      if (marcador === 0xffe1 && v.getUint32(p + 4) === 0x45786966) return lerTiff(v, p + 10) // "Exif"
      p += 2 + tam
    }
  } catch { /* arquivo truncado ou corrompido */ }
  return null
}

function lerTiff(v: DataView, t: number): string | null {
  const le = v.getUint16(t) === 0x4949 // "II" = little-endian
  const u16 = (o: number) => v.getUint16(t + o, le)
  const u32 = (o: number) => v.getUint32(t + o, le)
  const entradas = (ifd: number) => {
    const n = u16(ifd)
    return Array.from({ length: n }, (_, i) => ifd + 2 + i * 12)
  }
  const texto = (e: number) => {
    const n = u32(e + 4)
    const o = n > 4 ? u32(e + 8) : e + 8
    let s = ''
    for (let i = 0; i < n; i++) { const c = v.getUint8(t + o + i); if (c === 0) break; s += String.fromCharCode(c) }
    return s
  }
  let dataHora: string | null = null
  let original: string | null = null
  const ifd0 = u32(4)
  for (const e of entradas(ifd0)) {
    const tag = u16(e)
    if (tag === 0x0132) dataHora = texto(e)
    if (tag === 0x8769) {
      for (const e2 of entradas(u32(e + 8))) if (u16(e2) === 0x9003) original = texto(e2)
    }
  }
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/.exec(original ?? dataHora ?? '')
  if (!m || m[1] === '0000') return null
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`
}

/** Arquivo ZIP começa com "PK\x03\x04". */
export const ehZip = (b: Uint8Array) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04
