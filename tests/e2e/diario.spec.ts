import { expect, test, type Page } from '@playwright/test'
import { br, diasAtras, gerarJPEG, HOJE, lerTabela } from './apoio'

// ---------------------------------------------------------------------------
// Apoio
// ---------------------------------------------------------------------------

const D3 = diasAtras(3) // dia com diário semeado
const D5 = diasAtras(5) // dia só com medição (não entra no relatório)
const OBRA = 'obra-teste'

function backupSemente() {
  const t = new Date().toISOString()
  const b = { createdAt: t, updatedAt: t }
  const freq = (f: string, status: string) => ({ id: `${HOJE}__${f}`, obraId: OBRA, data: HOJE, funcionarioId: f, status, ...b })
  return {
    app: 'diario-de-obra', versao: 1, exportadoEm: t,
    dados: {
      meta: [{ key: 'obraAtivaId', value: OBRA }],
      obras: [{ id: OBRA, nome: 'Obra Teste', empresa: 'BW Engenharia', local: 'Rua das Flores', ...b }],
      servicos: [{ id: 's1', obraId: OBRA, nome: 'Meio-fio', unidade: 'm', quantidadePrevista: 500, ...b }],
      trechos: [{ id: 't1', obraId: OBRA, nome: 'Trecho 1', ...b }],
      funcionarios: ['f1', 'f2', 'f3'].map((id, i) => ({ id, obraId: OBRA, nome: `Pessoa ${i + 1}`, funcao: 'Servente', ativo: true, ...b })),
      frequencias: [freq('f1', 'presente'), freq('f2', 'atraso'), freq('f3', 'falta')],
      medicoes: [
        { id: 'm1', obraId: OBRA, data: HOJE, servicoId: 's1', quantidade: 12.5, ...b },
        { id: 'm2', obraId: OBRA, data: HOJE, servicoId: 's1', quantidade: 7.5, ...b },
        { id: 'm3', obraId: OBRA, data: D5, servicoId: 's1', quantidade: 30, ...b },
      ],
      diarios: [{ id: `${OBRA}__${D3}`, obraId: OBRA, data: D3, atividades: 'Concretagem do trecho 1 (semeado)', ...b }],
    },
  }
}

async function importar(page: Page, arquivo: { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto('/#/ajustes')
  page.once('dialog', (d) => void d.accept())
  await page.getByTestId('input-importar').setInputFiles(arquivo)
}

async function semear(page: Page) {
  await importar(page, { name: 'semente.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backupSemente())) })
  await expect(page.getByText(/Importação concluída/)).toBeVisible()
}

const atividades = (page: Page) => page.getByLabel('Atividades realizadas no dia')

// ---------------------------------------------------------------------------
// Diário
// ---------------------------------------------------------------------------

test('diário: salva sozinho, persiste ao recarregar, troca de data e volta', async ({ page }) => {
  await page.goto('/#/diario')
  await atividades(page).fill('Escavação da vala entre as estacas 10 e 14.')
  await page.getByRole('group', { name: 'Clima da manhã' }).getByRole('button', { name: 'Bom' }).click()
  await page.getByRole('group', { name: 'Houve paralisação?' }).getByRole('button', { name: 'Sim' }).click()
  await page.getByLabel('Motivo (opcional)').fill('Chuva às 15h')
  await page.getByLabel('Novo equipamento').fill('Retroescavadeira')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByText('Salvo ✓')).toBeVisible()

  await page.reload()
  await expect(atividades(page)).toHaveValue('Escavação da vala entre as estacas 10 e 14.')
  await expect(page.getByRole('group', { name: 'Clima da manhã' }).getByRole('button', { name: 'Bom' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Motivo (opcional)')).toHaveValue('Chuva às 15h')
  await expect(page.getByText('Retroescavadeira')).toBeVisible()

  // dia anterior: formulário vazio; escreve e volta
  await page.getByRole('button', { name: 'Dia anterior' }).click()
  await expect(atividades(page)).toHaveValue('')
  await atividades(page).fill('Limpeza do canteiro.')
  await expect(page.getByText('Salvo ✓')).toBeVisible()
  await page.getByRole('button', { name: 'Próximo dia' }).click()
  await expect(atividades(page)).toHaveValue('Escavação da vala entre as estacas 10 e 14.')
  await page.getByRole('button', { name: 'Dia anterior' }).click()
  await expect(atividades(page)).toHaveValue('Limpeza do canteiro.')

  // um diário por dia (id fixo), nunca duplicado
  const diarios = await lerTabela<{ data: string; id: string }>(page, 'diarios')
  expect(diarios.filter((d) => d.data === HOJE)).toHaveLength(1)
  expect(diarios.find((d) => d.data === HOJE)!.id).toMatch(new RegExp(`__${HOJE}$`))
  await expect(page.getByTestId('dias-registrados')).toContainText('Escavação da vala')
  await expect(page.getByTestId('dias-registrados')).toContainText('Limpeza do canteiro')
})

test('diário mostra efetivo e produção do dia vindos do backup importado', async ({ page }) => {
  await semear(page)
  await page.goto('/#/diario')
  const efetivo = page.getByTestId('efetivo')
  await expect(efetivo.locator('.resumo.ok b')).toHaveText('1')
  await expect(efetivo.locator('.resumo.atraso b')).toHaveText('1')
  await expect(efetivo.locator('.resumo.falta b')).toHaveText('1')
  await expect(page.getByTestId('producao')).toContainText('Meio-fio')
  await expect(page.getByTestId('producao')).toContainText('20 m')
  // dias úteis sem diário aparecem como pendentes
  await expect(page.getByTestId('dias-registrados').locator('.etq.atraso').first()).toHaveText('pendente')
})

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

test.describe('fotos com GPS', () => {
  test.use({ permissions: ['geolocation'], geolocation: { latitude: -23.55052, longitude: -46.633308, accuracy: 12 } })

  test('adiciona 2 fotos reduzidas, abre, edita legenda e exclui', async ({ page }) => {
    await page.goto('/#/fotos')
    const paisagem = await gerarJPEG(page, 4000, 3000, 'paisagem.jpg')
    const retrato = await gerarJPEG(page, 3000, 4000, 'retrato.jpg')
    await page.getByTestId('input-galeria').setInputFiles([paisagem, retrato])
    await expect(page.getByText('2 fotos salvas.')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.grade-fotos li')).toHaveCount(2)
    await expect(page.locator('.grade-fotos .etq', { hasText: 'GPS' })).toHaveCount(2)

    const fotos = await lerTabela<{ latitude: number; data: string; arquivo?: unknown; tamanho: number }>(page, 'fotos')
    for (const f of fotos) {
      expect(f.latitude).toBeCloseTo(-23.55052, 4)
      expect(f.data).toBe(HOJE)
      expect(f.arquivo).toBeUndefined() // sem Blob no registro (iOS)
      expect(f.tamanho).toBeGreaterThan(0)
    }
    // bytes como ArrayBuffer na tabela 'imagens', já reduzidos
    type I = { id: string; tipo: string; dados: { tamanho: number; largura: number; altura: number } }
    const imagens = await lerTabela<I>(page, 'imagens')
    const grandes = imagens.filter((i) => i.id.endsWith('__grande'))
    const minis = imagens.filter((i) => i.id.endsWith('__mini'))
    expect(grandes.map((i) => `${i.dados.largura}x${i.dados.altura}`).sort()).toEqual(['1200x1600', '1600x1200'])
    expect(minis.map((i) => Math.max(i.dados.largura, i.dados.altura))).toEqual([320, 320])
    expect(grandes.every((i) => i.tipo === 'image/jpeg')).toBe(true)
    const original = Math.min(paisagem.buffer.length, retrato.buffer.length)
    expect(Math.max(...grandes.map((i) => i.dados.tamanho))).toBeLessThan(original)

    // ampliada: legenda, link do mapa
    await page.locator('.foto-celula').first().click()
    const modal = page.getByRole('dialog')
    await expect(modal.getByRole('link', { name: 'Ver no mapa' })).toHaveAttribute('href', /google\.com\/maps\?q=-23\.55052,-46\.633308/)
    await modal.getByLabel('Legenda').fill('Vala aberta na estaca 12')
    await modal.getByRole('button', { name: 'Concluir' }).click()
    await expect(page.locator('.foto-legenda', { hasText: 'Vala aberta na estaca 12' })).toBeVisible()
    await page.reload()
    await expect(page.locator('.foto-legenda', { hasText: 'Vala aberta na estaca 12' })).toBeVisible()

    // excluir (com confirmação)
    await page.locator('.foto-celula').first().click()
    page.once('dialog', (d) => void d.accept())
    await page.getByRole('dialog').getByRole('button', { name: 'Excluir foto' }).click()
    await expect(page.locator('.grade-fotos li')).toHaveCount(1)
    const depois = await lerTabela<{ id: string; deletedAt?: string }>(page, 'fotos')
    expect(depois.filter((f) => f.deletedAt)).toHaveLength(1) // exclusão lógica
    const excluida = depois.find((f) => f.deletedAt)!.id
    // bytes descartados para liberar espaço
    expect((await lerTabela<{ fotoId: string }>(page, 'imagens')).filter((i) => i.fotoId === excluida)).toHaveLength(0)

    // aba Todas agrupa por dia
    await page.getByRole('button', { name: /Todas/ }).click()
    await expect(page.locator('.grupo-dia')).toHaveCount(1)
    await expect(page.locator('.grupo-dia')).toContainText(br(HOJE))
  })
})

test('foto sem permissão de GPS é salva assim mesmo, com aviso', async ({ page }) => {
  await page.goto('/#/diario')
  await page.getByTestId('input-galeria').first().setInputFiles(await gerarJPEG(page, 800, 600, 'a.jpg'))
  await expect(page.getByText('1 foto salva.')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/Salvas sem GPS/)).toBeVisible()
  await expect(page.locator('#fotos .grade-fotos li')).toHaveCount(1)
})

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

test('relatório do período tem só os dias com diário ou fotos', async ({ page }) => {
  await semear(page)
  await page.goto('/#/diario')
  await atividades(page).fill('Assentamento de meio-fio no trecho 1.')
  await expect(page.getByText('Salvo ✓')).toBeVisible()

  await page.getByRole('button', { name: 'Gerar relatório' }).click()
  await page.getByRole('button', { name: 'Por período' }).click()
  await page.getByLabel('De', { exact: true }).fill(diasAtras(10))
  await page.getByLabel('Até', { exact: true }).fill(HOJE)
  await page.getByRole('button', { name: 'Abrir relatório' }).click()

  await expect(page).toHaveURL(/#\/relatorio\?de=/)
  const dias = page.locator('.rel-dia')
  await expect(dias).toHaveCount(2)
  expect(await dias.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.dia))).toEqual([D3, HOJE])
  await expect(page.locator(`[data-dia="${D5}"]`)).toHaveCount(0)
  const hoje = page.locator(`[data-dia="${HOJE}"]`)
  await expect(hoje).toContainText('Assentamento de meio-fio')
  await expect(hoje).toContainText('1 presentes · 1 com atraso · 1 faltas')
  await expect(hoje).toContainText('20 m')
  await expect(hoje).toContainText('Contratante: BW Engenharia')
  await expect(hoje).toContainText('Elaborado por EliTech')
  await expect(page.locator(`[data-dia="${D3}"]`)).toContainText('Concretagem do trecho 1')
  // nada que o usuário não preencheu
  await expect(page.locator(`[data-dia="${D3}"]`)).not.toContainText('Clima')
  await expect(page.locator(`[data-dia="${D3}"]`)).not.toContainText('Equipamentos')
  // sem topo nem abas do app (página limpa para imprimir)
  await expect(page.locator('nav.abas')).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

test('backup completo (ZIP) exporta e reimporta com as fotos', async ({ page }) => {
  await semear(page)
  await page.goto('/#/diario')
  await page.getByTestId('input-galeria').first().setInputFiles([
    await gerarJPEG(page, 2000, 1500, 'a.jpg'), await gerarJPEG(page, 1000, 1000, 'b.jpg'),
  ])
  await expect(page.getByText('2 fotos salvas.')).toBeVisible({ timeout: 30_000 })

  await page.goto('/#/ajustes')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Backup completo (com fotos)' }).click()
  const arquivo = await download
  expect(arquivo.suggestedFilename()).toMatch(/^diario-obra-completo-.*\.zip$/)
  const caminho = test.info().outputPath('backup.zip')
  await arquivo.saveAs(caminho)

  // apaga tudo e confirma que as fotos sumiram
  page.once('dialog', (d) => void d.accept())
  const recarregou = page.waitForEvent('load')
  await page.getByRole('button', { name: 'Apagar todos os dados' }).click()
  await recarregou
  await expect(page.locator('.topo-texto span')).toHaveText('Minha obra') // app aberto de novo, banco vazio
  expect(await lerTabela(page, 'fotos')).toHaveLength(0)

  await page.goto('/#/ajustes')
  page.once('dialog', (d) => void d.accept())
  await page.getByTestId('input-importar').setInputFiles(caminho)
  await expect(page.getByText(/Importação concluída \(\d+ registros, 2 fotos\)/)).toBeVisible()

  await page.goto('/#/fotos')
  await expect(page.locator('.grade-fotos img')).toHaveCount(2)
  await expect.poll(() => page.locator('.grade-fotos img').evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).naturalWidth > 0))).toBe(true)
  await page.goto(`/#/diario?data=${D3}`)
  await expect(atividades(page)).toHaveValue('Concretagem do trecho 1 (semeado)')
})

test('arquivo inválido é rejeitado e os dados continuam', async ({ page }) => {
  await semear(page)
  const invalidos = [
    { name: 'lixo.json', mimeType: 'application/json', buffer: Buffer.from('isto não é um backup') },
    { name: 'outro.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'outro', versao: 1, dados: {} })) },
    { name: 'quebrado.zip', mimeType: 'application/zip', buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('lixo lixo lixo')]) },
  ]
  for (const arq of invalidos) {
    await importar(page, arq)
    await expect(page.getByText(/Nada foi alterado/)).toBeVisible()
  }
  await page.goto(`/#/diario?data=${D3}`)
  await expect(atividades(page)).toHaveValue('Concretagem do trecho 1 (semeado)')
  await expect(page.locator('.topo-texto span')).toHaveText('Obra Teste')
})

// ---------------------------------------------------------------------------
// Offline
// ---------------------------------------------------------------------------

test('abre sem internet depois da primeira visita', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready
    return navigator.serviceWorker.controller !== null
  })
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('Diário de hoje')).toBeVisible()
  await page.getByRole('link', { name: 'Diário', exact: true }).click()
  await atividades(page).fill('Registrado sem sinal.')
  await expect(page.getByText('Salvo ✓')).toBeVisible()
})
