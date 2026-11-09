// Regressão do bug do iPhone: fotos quebradas na grade e no relatório depois de recarregar.
import { expect, test, type Page } from '@playwright/test'
import { gerarJPEG, HOJE, lerTabela } from './apoio'

/** Todas as <img> do seletor carregadas de verdade (naturalWidth > 0). */
async function esperarImagensOk(page: Page, seletor: string, quantas: number) {
  await expect(page.locator(seletor)).toHaveCount(quantas)
  await expect.poll(() => page.locator(seletor).evaluateAll((imgs) =>
    imgs.map((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0)), { timeout: 15_000 })
    .toEqual(Array(quantas).fill(true))
}

async function adicionarDuasFotos(page: Page) {
  await page.goto('/#/fotos')
  const fotos = [await gerarJPEG(page, 4032, 3024, 'IMG_0001.jpg'), await gerarJPEG(page, 3024, 4032, 'IMG_0002.jpg')]
  await page.getByTestId('input-galeria').setInputFiles(fotos)
  await expect(page.getByText('2 fotos salvas.')).toBeVisible({ timeout: 30_000 })
}

/** Troca window.print por um registro do estado das imagens no momento da impressão. */
async function interceptarImpressao(page: Page) {
  await page.evaluate(() => {
    const w = window as Window & { __impressao?: number[] }
    window.print = () => {
      w.__impressao = Array.from(document.querySelectorAll<HTMLImageElement>('.relatorio img'))
        .map((i) => (i.complete ? i.naturalWidth : 0))
    }
  })
}

const larguraNaImpressao = (page: Page) =>
  page.evaluate(() => (window as Window & { __impressao?: number[] }).__impressao ?? null)

test('fotos continuam aparecendo depois de recarregar', async ({ page }) => {
  await adicionarDuasFotos(page)
  await esperarImagensOk(page, '.grade-fotos img', 2)
  await page.reload()
  await esperarImagensOk(page, '.grade-fotos img', 2)
  await expect(page.getByText('Foto indisponível')).toHaveCount(0)

  // editar a legenda (o liveQuery reemite a foto) não recria a URL da miniatura
  const antes = await page.locator('.grade-fotos img').first().getAttribute('src')
  await page.locator('.foto-celula').first().click()
  await page.getByRole('dialog').getByLabel('Legenda').fill('Teste de URL estável')
  await page.getByRole('dialog').getByRole('button', { name: 'Concluir' }).click()
  await expect(page.locator('.foto-legenda', { hasText: 'Teste de URL estável' })).toBeVisible()
  expect(await page.locator('.grade-fotos img').first().getAttribute('src')).toBe(antes)
  await esperarImagensOk(page, '.grade-fotos img', 2)
})

test('relatório carrega as próprias fotos e só imprime com todas carregadas', async ({ page }) => {
  await adicionarDuasFotos(page)
  // abre o relatório numa página nova (sem nenhuma URL criada pela tela de fotos)
  await page.goto(`/#/relatorio?de=${HOJE}&ate=${HOJE}`)
  await page.reload()
  await interceptarImpressao(page)
  const botao = page.getByRole('button', { name: 'Imprimir / Salvar PDF' })
  await expect(botao).toBeEnabled({ timeout: 15_000 })
  await botao.click()
  await expect.poll(() => larguraNaImpressao(page)).not.toBeNull()
  const larguras = (await larguraNaImpressao(page))!
  expect(larguras).toHaveLength(2)
  expect(larguras.every((w) => w > 0)).toBe(true)
  await expect(page.locator('.relatorio .foto-indisponivel')).toHaveCount(0)
})

test('sem internet: grade e relatório mostram as fotos depois de recarregar', async ({ page, context }) => {
  await adicionarDuasFotos(page)
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready
    return navigator.serviceWorker.controller !== null
  })
  await context.setOffline(true)
  await page.reload()
  await esperarImagensOk(page, '.grade-fotos img', 2)

  await page.goto(`/#/relatorio?de=${HOJE}&ate=${HOJE}`)
  await page.reload()
  await esperarImagensOk(page, '.relatorio img', 2)
  await interceptarImpressao(page)
  await page.getByRole('button', { name: 'Imprimir / Salvar PDF' }).click()
  await expect.poll(async () => (await larguraNaImpressao(page))?.every((w) => w > 0)).toBe(true)
})

test('migra fotos antigas (Blob) e marca as ilegíveis como indisponíveis, sem apagar', async ({ page }) => {
  // Cria o banco como a v0.3 deixava (Dexie v2 = IndexedDB versão 20), com a imagem em Blob dentro da foto.
  await page.goto('/manifest.webmanifest') // mesma origem, sem abrir o app
  await page.evaluate(async (hoje) => {
    const c = document.createElement('canvas')
    c.width = 800; c.height = 600
    const x = c.getContext('2d')!
    x.fillStyle = '#c96'; x.fillRect(0, 0, 800, 600)
    const jpeg = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), 'image/jpeg', 0.8))
    const esquema: Record<string, [string, string[]]> = {
      meta: ['key', []], obras: ['id', []], servicos: ['id', ['obraId']], trechos: ['id', ['obraId']],
      funcionarios: ['id', ['obraId', 'nome']], frequencias: ['id', ['obraId', 'data', 'funcionarioId']],
      medicoes: ['id', ['obraId', 'data', 'servicoId', 'trechoId']], diarios: ['id', ['obraId', 'data']],
      ocorrencias: ['id', ['obraId', 'data', 'tipo']], fotos: ['id', ['obraId', 'data', 'servicoId', 'trechoId']],
      materiais: ['id', ['obraId', 'servicoId']], entregas: ['id', ['obraId', 'materialId', 'data']],
    }
    await new Promise<void>((ok, falha) => {
      const r = indexedDB.open('diario-de-obra', 20)
      r.onupgradeneeded = () => {
        for (const [nome, [chave, indices]] of Object.entries(esquema)) {
          const st = r.result.createObjectStore(nome, { keyPath: chave })
          for (const i of indices) st.createIndex(i, i)
        }
      }
      r.onerror = () => falha(r.error)
      r.onsuccess = () => {
        const t = new Date().toISOString()
        const tx = r.result.transaction(['meta', 'obras', 'fotos'], 'readwrite')
        tx.objectStore('meta').put({ key: 'obraAtivaId', value: 'o1' })
        tx.objectStore('obras').put({ id: 'o1', nome: 'Obra antiga', empresa: '', local: '', createdAt: t, updatedAt: t })
        const foto = (id: string, hora: string, arquivo: Blob) =>
          ({ id, obraId: 'o1', data: hoje, hora, arquivo, miniatura: arquivo, createdAt: t, updatedAt: t })
        tx.objectStore('fotos').put(foto('boa', '07:50', jpeg))
        tx.objectStore('fotos').put(foto('vazia', '07:53', new Blob([]))) // como o iOS devolvia: Blob vazio
        tx.objectStore('fotos').put(foto('corrompida', '07:55', new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/jpeg' })))
        tx.oncomplete = () => { r.result.close(); ok() }
      }
    })
  }, HOJE)

  await page.goto('/#/fotos')
  await expect(page.locator('.grade-fotos li')).toHaveCount(3)
  await esperarImagensOk(page, '.grade-fotos img', 1)
  // a vazia (sem bytes) e a corrompida (onError) viram placeholder, nunca ícone quebrado
  await expect(page.locator('.grade-fotos .foto-indisponivel')).toHaveCount(2)

  type F = { id: string; indisponivel?: boolean; tamanho?: number; arquivo?: unknown; deletedAt?: string }
  const fotos = await lerTabela<F>(page, 'fotos')
  expect(fotos).toHaveLength(3) // nenhum registro apagado
  const boa = fotos.find((f) => f.id === 'boa')!
  expect(boa.arquivo).toBeUndefined()
  expect(boa.tamanho).toBeGreaterThan(0)
  expect(fotos.find((f) => f.id === 'vazia')!.indisponivel).toBe(true)
  const imagens = await lerTabela<{ id: string }>(page, 'imagens')
  expect(imagens.map((i) => i.id).sort()).toEqual(['boa__grande', 'boa__mini', 'corrompida__grande', 'corrompida__mini'])

  // "Remover" no placeholder (com confirmação) faz exclusão lógica
  page.once('dialog', (d) => void d.accept())
  await page.locator('.grade-fotos li', { hasText: '07:53' }).getByRole('button', { name: 'Remover' }).click()
  await expect(page.locator('.grade-fotos li')).toHaveCount(2)
  expect((await lerTabela<F>(page, 'fotos')).find((f) => f.id === 'vazia')!.deletedAt).toBeTruthy()
})
