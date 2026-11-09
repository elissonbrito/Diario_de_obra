import { Fragment, useCallback, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Diario, Foto, Servico, Trecho } from '../db/types'
import { useDados } from '../hooks/useDados'
import { useLogoEmpresa } from '../hooks/useLogoEmpresa'
import { FotoImagem } from '../components/FotoImagem'
import { compartilharOuBaixar } from '../lib/compartilhar'
import { diasDoRelatorio, efetivoDoDia, idDiario, producaoDoDia, rotuloClima } from '../lib/diario'
import { bytesParaDataURL, coordenadas } from '../lib/fotos'
import { lerImagem } from '../repo/fotos'
import { dataBR, dataLocal, diaSemana, formatNumero } from '../lib/util'

// Estilo do relatório num texto só: vale na tela, na impressão e no arquivo HTML compartilhado.
const CSS_RELATORIO = `
.relatorio { max-width: 210mm; margin: 0 auto; color: #1a2233; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.4; }
.rel-dia { position: relative; background: #fff; padding: 15mm; margin: 0 0 16px; box-shadow: 0 1px 4px rgba(0,0,0,.12); }
/* marca d'água: por cima de tudo, mas quase transparente e sem pegar toque (não atrapalha leitura nem fotos) */
.rel-marca, .rel-marca-pagina { pointer-events: none; opacity: .07; object-fit: contain; z-index: 2; }
.rel-marca { position: absolute; top: 50%; left: 50%; width: 70%; max-height: 60%; transform: translate(-50%, -50%); }
.rel-marca-pagina { display: none; }
.rel-cab { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #7d152e; padding-bottom: 8px; margin-bottom: 12px; }
.rel-logo { height: 60px; max-width: 200px; object-fit: contain; flex: none; }
.rel-cab h1 { font-size: 14pt; margin: 0; color: #0b2b5e; }
.rel-cab p { margin: 0; font-size: 9.5pt; color: #5b6577; }
.rel-dia h2 { font-size: 13pt; color: #0b2b5e; margin: 0 0 8px; }
.rel-dia h2::first-letter { text-transform: uppercase; }
.rel-dia h3 { font-size: 10.5pt; color: #0b2b5e; margin: 12px 0 4px; text-transform: uppercase; letter-spacing: .03em; }
.rel-dia p { margin: 0 0 4px; }
.rel-texto { white-space: pre-wrap; overflow-wrap: anywhere; }
.rel-tabela { border-collapse: collapse; width: 100%; font-size: 10pt; }
.rel-tabela td { border-bottom: 1px solid #d9dfea; padding: 3px 4px; }
.rel-tabela td:last-child { text-align: right; white-space: nowrap; }
.rel-fotos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }
.rel-fotos figure { margin: 0; break-inside: avoid; page-break-inside: avoid; border: 1px solid #d9dfea; border-radius: 4px; padding: 4px; }
.rel-fotos img { width: 100%; height: 62mm; object-fit: contain; background: #f3f5f9; display: block; }
.rel-fotos .foto-indisponivel { height: 62mm; display: flex; align-items: center; justify-content: center; background: #f3f5f9; color: #5b6577; font-size: 9pt; border: 1px dashed #d9dfea; }
.rel-fotos figcaption { font-size: 8.5pt; color: #5b6577; margin-top: 3px; overflow-wrap: anywhere; }
.rel-fotos figcaption b { color: #1a2233; }
.rel-assinatura { margin: 22mm auto 0; width: 70%; text-align: center; break-inside: avoid; page-break-inside: avoid; }
.rel-assinatura .linha { border-top: 1px solid #1a2233; margin-bottom: 4px; }
.rel-assinatura p { margin: 0; font-size: 9.5pt; }
.rel-assinatura .empresa { color: #5b6577; font-size: 9pt; }
.rel-rodape { margin-top: 12mm; padding-top: 4px; border-top: 1px solid #eceff5; font-size: 8.5pt; color: #5b6577; display: flex; justify-content: space-between; align-items: baseline; }
.rel-rodape .sistema { font-size: 6.5pt; color: #a3abb8; letter-spacing: .02em; }
.rel-vazio { background: #fff; padding: 24px; text-align: center; color: #5b6577; }
@media screen and (max-width: 640px) {
  .rel-dia { padding: 16px 14px; }
  .rel-fotos img, .rel-fotos .foto-indisponivel { height: auto; aspect-ratio: 4 / 3; }
}
@page { size: A4; margin: 15mm; @bottom-right { content: "Página " counter(page) " de " counter(pages); font-size: 8pt; color: #5b6577; } }
@media print {
  html, body { background: #fff !important; }
  .nao-imprimir { display: none !important; }
  .relatorio { max-width: none; }
  .rel-dia { padding: 0; margin: 0; box-shadow: none; break-after: page; page-break-after: always; }
  .rel-dia:last-child { break-after: auto; page-break-after: auto; }
  /* na impressão, um elemento fixo se repete em cada folha: a marca sai em todas as páginas, não só na 1ª do dia */
  .rel-marca { display: none; }
  .rel-marca-pagina { display: block; position: fixed; top: 50%; left: 50%; width: 140mm; max-height: 140mm; transform: translate(-50%, -50%); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h2, h3 { break-after: avoid; page-break-after: avoid; }
}
`

export default function Relatorio() {
  const { obra, servicos, trechos, funcionariosTodos, frequencias, medicoes, diarios, fotos } = useDados()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const hoje = dataLocal()
  const de = params.get('de') || hoje
  const ate = params.get('ate') || de
  const logo = useLogoEmpresa(obra)
  const marca = obra.marcaDagua && logo ? logo : null
  const artigo = useRef<HTMLElement>(null)
  const [msg, setMsg] = useState('')

  const dias = diasDoRelatorio(de, ate, diarios, fotos)
  // Cada foto avisa quando carregou (ou falhou); só deixa imprimir com todas resolvidas.
  const [estados, setEstados] = useState<Record<string, 'ok' | 'indisponivel'>>({})
  const informar = useCallback((id: string, e: 'ok' | 'indisponivel') => {
    setEstados((atual) => (atual[id] === e ? atual : { ...atual, [id]: e }))
  }, [])
  const fotosDoRelatorio = fotos.filter((f) => dias.includes(f.data))
  const resolvidas = fotosDoRelatorio.filter((f) => estados[f.id]).length
  const indisponiveis = fotosDoRelatorio.filter((f) => estados[f.id] === 'indisponivel').length
  const pronto = resolvidas === fotosDoRelatorio.length
  const validos = new Set(funcionariosTodos.filter((f) => !f.deletedAt).map((f) => f.id))
  const periodo = de === ate ? `Data: ${dataBR(de)}` : `Período: ${dataBR(de)} a ${dataBR(ate)}`
  const nomeArquivo = `relatorio-${obra.nome.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase()}-${de}${de === ate ? '' : `_${ate}`}.html`

  // Plano B para o app instalado no iPhone, onde a impressão pode não abrir: um arquivo HTML com as fotos dentro,
  // que o iPhone abre, imprime e salva em PDF pela folha de compartilhamento.
  async function compartilharArquivo() {
    if (!artigo.current) return
    setMsg('Preparando arquivo…')
    try {
      const copia = artigo.current.cloneNode(true) as HTMLElement
      for (const fig of Array.from(copia.querySelectorAll<HTMLElement>('figure[data-foto-id]'))) {
        const img = fig.querySelector('img')
        const f = fotos.find((x) => x.id === fig.dataset.fotoId)
        const bytes = img && f ? await lerImagem(f, 'grande') : null
        if (img && bytes) {
          img.src = await bytesParaDataURL(bytes)
          img.removeAttribute('loading')
        }
      }
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
        + `<title>${escapar(obra.nome)} – ${escapar(periodo)}</title><style>body{margin:0;padding:12px;background:#f3f5f9}${CSS_RELATORIO}</style></head>`
        + `<body>${copia.outerHTML}</body></html>`
      const como = await compartilharOuBaixar(new File([html], nomeArquivo, { type: 'text/html' }), 'Relatório do Diário de Obra')
      setMsg(como === 'compartilhado' ? '' : 'Arquivo baixado.')
    } catch (e) {
      setMsg((e as Error).name === 'AbortError' ? '' : `Falha ao gerar o arquivo: ${(e as Error).message}`)
    }
  }

  /** Espera todas as imagens decodificarem antes de abrir a impressão (senão saem em branco no PDF). */
  async function imprimir() {
    if (!artigo.current) return
    setMsg('Preparando as fotos…')
    const imgs = Array.from(artigo.current.querySelectorAll('img'))
    await Promise.all(imgs.map((i) => (i.complete && i.naturalWidth > 0 ? Promise.resolve() : i.decode().catch(() => undefined))))
    setMsg('')
    window.print()
  }

  return (
    <div className="relatorio-tela">
      <style>{CSS_RELATORIO}</style>
      <div className="rel-barra nao-imprimir">
        <button type="button" className="btn btn-sec" onClick={() => navigate(-1)}>‹ Voltar</button>
        <button type="button" className="btn btn-primario" onClick={() => void imprimir()} disabled={dias.length === 0 || !pronto}>
          {pronto ? 'Imprimir / Salvar PDF' : `Carregando fotos (${resolvidas}/${fotosDoRelatorio.length})…`}
        </button>
        <button type="button" className="btn btn-sec" onClick={() => void compartilharArquivo()} disabled={dias.length === 0 || !pronto}>
          Compartilhar arquivo
        </button>
        {pronto && indisponiveis > 0 && (
          <p className="erro pequeno" role="status">
            {indisponiveis === 1 ? '1 foto está indisponível' : `${indisponiveis} fotos estão indisponíveis`} e sai no relatório
            como “Foto indisponível”.
          </p>
        )}
        <p className="mudo pequeno">
          {msg || 'No iPhone: em “Imprimir”, abra a prévia e toque em Compartilhar → Salvar em Arquivos para ter o PDF. '
            + 'Se a impressão não abrir no app instalado, use “Compartilhar arquivo”.'}
        </p>
      </div>

      <article className="relatorio" ref={artigo}>
        {marca && <img className="rel-marca-pagina" src={marca} alt="" aria-hidden="true" />}
        {dias.length === 0 ? (
          <p className="rel-vazio">Nenhum dia com diário ou fotos em {de === ate ? dataBR(de) : `${dataBR(de)} a ${dataBR(ate)}`}.</p>
        ) : dias.map((d) => (
          <DiaRelatorio
            key={d}
            data={d}
            cabecalho={<Cabecalho nome={obra.nome} empresa={obra.empresa} local={obra.local} periodo={periodo} logo={logo} />}
            empresa={obra.empresa}
            marca={marca}
            diario={diarios.find((x) => x.id === idDiario(obra.id, d))}
            fotos={fotos.filter((f) => f.data === d)}
            efetivo={efetivoDoDia(frequencias, d, validos)}
            producao={producaoDoDia(servicos, medicoes, d)}
            servicos={servicos}
            trechos={trechos}
            informar={informar}
          />
        ))}
      </article>
    </div>
  )
}

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

function Cabecalho({ nome, empresa, local, periodo, logo }: { nome: string; empresa: string; local: string; periodo: string; logo?: string | null }) {
  return (
    <header className="rel-cab">
      {logo && <img className="rel-logo" src={logo} alt={empresa.trim() ? `Logo de ${empresa}` : 'Logo da empresa'} />}
      <div>
        <h1>Diário de Obra – {nome}</h1>
        {empresa.trim() && <p>Empresa: {empresa}</p>}
        {local.trim() && <p>Local: {local}</p>}
        <p>{periodo}</p>
      </div>
    </header>
  )
}

type Informar = (id: string, e: 'ok' | 'indisponivel') => void

function DiaRelatorio({
  data, cabecalho, empresa, marca, diario, fotos, efetivo, producao, servicos, trechos, informar,
}: {
  data: string; cabecalho: ReactNode; empresa: string; marca: string | null; diario?: Diario; fotos: Foto[]
  efetivo: ReturnType<typeof efetivoDoDia>; producao: ReturnType<typeof producaoDoDia>
  servicos: Servico[]; trechos: Trecho[]; informar: Informar
}) {
  const clima = [
    diario?.climaManha && `Manhã: ${rotuloClima(diario.climaManha)}`,
    diario?.climaTarde && `Tarde: ${rotuloClima(diario.climaTarde)}`,
  ].filter(Boolean).join(' · ')
  const equipamentos = diario?.equipamentos ?? []
  return (
    <section className="rel-dia" data-dia={data}>
      {marca && <img className="rel-marca" src={marca} alt="" aria-hidden="true" />}
      {cabecalho}
      <h2>{diaSemana(data)}, {dataBR(data)}</h2>
      {clima && <p><b>Clima</b> – {clima}</p>}
      {diario?.paralisacao === true && (
        <p><b>Houve paralisação</b>{diario.motivoParalisacao?.trim() ? ` – ${diario.motivoParalisacao.trim()}` : ''}</p>
      )}
      {diario?.paralisacao === false && <p><b>Sem paralisação</b></p>}

      {efetivo.total > 0 && (
        <>
          <h3>Efetivo</h3>
          <p>{efetivo.presentes} presentes · {efetivo.atrasos} com atraso · {efetivo.faltas} faltas</p>
        </>
      )}

      {producao.length > 0 && (
        <>
          <h3>Produção do dia</h3>
          <table className="rel-tabela">
            <tbody>
              {producao.map(({ servico, quantidade }) => (
                <tr key={servico.id}><td>{servico.nome}</td><td>{formatNumero(quantidade)} {servico.unidade}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {diario?.atividades?.trim() && (<><h3>Atividades realizadas</h3><p className="rel-texto">{diario.atividades.trim()}</p></>)}
      {!diario?.atividades?.trim() && diario?.resumo?.trim() && (<><h3>Atividades realizadas</h3><p className="rel-texto">{diario.resumo.trim()}</p></>)}

      {equipamentos.length > 0 && (<><h3>Equipamentos em obra</h3><p>{equipamentos.join(' · ')}</p></>)}

      {diario?.ocorrencias?.trim() && (<><h3>Ocorrências / observações</h3><p className="rel-texto">{diario.ocorrencias.trim()}</p></>)}

      {fotos.length > 0 && (
        <>
          <h3>Registro fotográfico ({fotos.length})</h3>
          <div className="rel-fotos">
            {fotos.map((f) => <FotoRelatorio key={f.id} foto={f} servicos={servicos} trechos={trechos} informar={informar} />)}
          </div>
        </>
      )}

      <div className="rel-assinatura">
        <div className="linha" />
        <p>Assinatura do responsável pela empresa</p>
        {empresa.trim() && <p className="empresa">{empresa}</p>}
      </div>

      {/* EliTech fica visível, mas discreto: o destaque do relatório é da empresa da obra */}
      <footer className="rel-rodape"><span className="sistema">Elaborado por EliTech</span><span>{dataBR(data)}</span></footer>
    </section>
  )
}

function FotoRelatorio({ foto, servicos, trechos, informar }: { foto: Foto; servicos: Servico[]; trechos: Trecho[]; informar: Informar }) {
  const aoEstado = useCallback((e: 'ok' | 'indisponivel') => informar(foto.id, e), [foto.id, informar])
  const extras = [servicos.find((s) => s.id === foto.servicoId)?.nome, trechos.find((t) => t.id === foto.trechoId)?.nome].filter(Boolean)
  return (
    <figure data-foto-id={foto.id}>
      {/* sem lazy: na impressão as fotos fora da tela também precisam estar carregadas */}
      <FotoImagem foto={foto} qual="grande" lazy={false} alt={foto.legenda || `Foto das ${foto.hora}`} onEstado={aoEstado} />
      <figcaption>
        <b>{foto.hora}</b>
        {foto.legenda && <> – {foto.legenda}</>}
        {extras.length > 0 && <><br />{extras.join(' · ')}</>}
        {foto.latitude !== undefined && foto.longitude !== undefined && (
          <Fragment><br />GPS {coordenadas(foto.latitude, foto.longitude)}{foto.precisaoM !== undefined && ` (±${foto.precisaoM} m)`}</Fragment>
        )}
      </figcaption>
    </figure>
  )
}
