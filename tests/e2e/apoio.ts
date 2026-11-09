import type { Page } from '@playwright/test'

// Apoio comum aos testes de ponta a ponta.

const p2 = (n: number) => String(n).padStart(2, '0')
export const dataLocal = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
export const diasAtras = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return dataLocal(d) }
export const br = (iso: string) => iso.split('-').reverse().join('/')

export const HOJE = dataLocal(new Date())

/** JPEG grande com ruído (gerado no próprio navegador), para provar que o app reduz antes de salvar. */
export async function gerarJPEG(page: Page, largura: number, altura: number, nome: string) {
  const b64 = await page.evaluate(([w, h]) => {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const x = c.getContext('2d')!
    for (let i = 0; i < 400; i++) {
      x.fillStyle = `hsl(${Math.random() * 360} 70% 50%)`
      x.fillRect(Math.random() * w, Math.random() * h, 50 + Math.random() * 400, 50 + Math.random() * 400)
    }
    return c.toDataURL('image/jpeg', 0.95).split(',')[1]
  }, [largura, altura])
  return { name: nome, mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') }
}

/** Lê direto do IndexedDB (sem passar pela tela). */
export function lerTabela<T = Record<string, unknown>>(page: Page, tabela: string): Promise<T[]> {
  return page.evaluate((nome) => new Promise((ok, falha) => {
    const r = indexedDB.open('diario-de-obra')
    r.onerror = () => falha(r.error)
    r.onsuccess = () => {
      const g = r.result.transaction(nome).objectStore(nome).getAll()
      g.onsuccess = async () => {
        const linhas = []
        for (const l of g.result) {
          const out: Record<string, unknown> = { ...l }
          for (const [k, v] of Object.entries(l)) {
            const blob = v instanceof Blob ? v : v instanceof ArrayBuffer ? new Blob([v]) : null
            if (blob) {
              const dims = blob.size
                ? await createImageBitmap(blob).then((b) => ({ largura: b.width, altura: b.height }), () => ({})) // bytes que não são imagem
                : {}
              out[k] = { tamanho: blob.size, ...dims }
            }
          }
          linhas.push(out)
        }
        r.result.close()
        ok(linhas as never)
      }
    }
  }), tabela)
}

