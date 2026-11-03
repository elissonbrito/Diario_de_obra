// Identificador único. crypto.randomUUID só existe em conexão segura (HTTPS/localhost);
// em teste por http://192.168.x.x usamos getRandomValues, que funciona sempre.
export function uid(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  c.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'))
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`
}

export const agoraISO = () => new Date().toISOString()

const p2 = (n: number) => String(n).padStart(2, '0')

/** Data local no formato AAAA-MM-DD (não usa UTC, para não virar o dia às 21h). */
export function dataLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

/** Hora local HH:MM. */
export function horaLocal(d: Date = new Date()): string {
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`
}

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

export function dataBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function diaSemana(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return DIAS[new Date(y, m - 1, d).getDay()]
}

export function deslocaDia(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return dataLocal(new Date(y, m - 1, d + delta))
}

export function ehIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function emModoApp(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

export function formatNumero(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export const brl = (n: number): string =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** 02/11 */
export function dataCurta(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export function diaSemanaCurto(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return DIAS_CURTOS[new Date(y, m - 1, d).getDay()]
}
