# Diário de Obra – EliTech

App web instalável (PWA) para acompanhamento diário de obra: cadastro de obra, serviços, trechos e equipe,
chamada diária, medição, análises, **diário de obra**, **fotos com data, hora e GPS**, **relatório em PDF** e backup.
Funciona **sem internet** depois da primeira abertura. Todos os dados ficam **só no aparelho** (IndexedDB).

> Versão 0.3. Detalhes dos módulos novos no fim deste arquivo.

## Rodar no computador

Precisa do Node 20 ou superior.

```bash
npm install
npm run dev        # abre em http://localhost:5173
```

Para testar no iPhone na mesma rede Wi-Fi: `npm run dev` mostra o endereço "Network"
(ex.: `http://192.168.0.10:5173`). Abra no Safari. Nesse modo (sem HTTPS) o app funciona,
mas **não** instala para uso offline. Para isso, publique (abaixo).

## Publicar de graça (necessário para instalar no iPhone)

O iPhone só instala e usa offline um PWA servido por **HTTPS**. Duas opções gratuitas:

### GitHub Pages (já configurado)
1. Crie um repositório no GitHub e envie este projeto (`git init`, `git add .`, `git commit`, `git push`).
2. No repositório: **Settings → Pages → Source: GitHub Actions**.
3. A cada `push` na branch `main`, o app é construído e publicado. O endereço aparece em Settings → Pages.

No plano grátis do GitHub, o Pages exige repositório **público**. Isso não expõe dados: o repositório só tem
o código, e os dados da obra ficam no celular.

### Cloudflare Pages (alternativa)
Conecte o repositório, com build `npm run build` e pasta de saída `dist`. Costuma aceitar repositório privado.

## Instalar no iPhone

1. Abra o endereço publicado **no Safari** (não no Chrome).
2. Toque em **Compartilhar → Adicionar à Tela de Início**.
3. Abra o app pelo ícone novo. Na primeira vez, use com internet para ele carregar tudo; depois funciona offline.

Instalado na Tela de Início, o iPhone não apaga os dados do app por inatividade, o que não é garantido
quando se usa só o Safari.

## Dados da obra e backup

- **Ajustes → Backup completo (com fotos)** gera um `.zip` com `dados.json` e as fotos em `fotos/<id>.jpg`
  (no iPhone abre a folha de compartilhamento: salve em Arquivos, no Drive ou mande no WhatsApp para você mesmo).
- **Ajustes → Backup rápido (sem fotos)** gera o `.json` leve de antes, bom para o dia a dia.
- **Ajustes → Importar arquivo** aceita os dois. O `.zip` substitui tudo, inclusive as fotos; o `.json` substitui
  os dados e mantém as fotos do aparelho. Arquivo inválido é recusado sem apagar nada.
- Para carregar a obra já preparada (serviços e quantidades), importe o arquivo `obra-bw.json`
  que acompanha a entrega. Ele não faz parte do repositório, para não publicar dados de cliente.

## Estrutura

```
src/
  db/        esquema do banco (Dexie/IndexedDB) e tipos — já inclui as tabelas das próximas etapas
  repo/      repositórios: única camada que fala com o banco (trocar por um servidor no futuro
             só exige mexer aqui)
  pages/     telas: Hoje, Chamada, Diário, Fotos, Relatório, Medição, Análises, Equipe, Obra, Ajustes
  components/ peças reutilizadas (Modal, SeletorData, AdicionarFotos, GradeFotos...)
  hooks/     useDados (dados da obra ativa), useObjectUrl (imagens sem vazar memória)
  state/     obra ativa
  lib/       funções puras (datas, análises, diário, imagem/EXIF) e utilitários de navegador (fotos, compartilhar)
tests/
  unit/      testes das funções puras
  e2e/       testes do app de ponta a ponta (Playwright, contra o `vite preview`)
```

## Testes

```bash
npx playwright install chromium   # só na primeira vez
npm test                          # unitários + ponta a ponta (constrói e sobe o preview sozinho)
npm run test:unit                 # só os unitários
```

Todo registro tem `id` único (UUID), `createdAt`, `updatedAt` e `deletedAt`, o que prepara o terreno
para sincronizar com um servidor depois, sem refazer o banco.

## Limites conhecidos

- Se o aparelho for perdido ou o app for removido, os dados vão junto: **o backup é a sua proteção**.
- O iPhone pede permissão de câmera e de localização na primeira foto. Se negar a localização, as fotos são salvas
  sem GPS (aparece um aviso); para reativar: Ajustes do iPhone → Privacidade → Serviços de Localização → Safari/app.
- **Sem HTTPS o GPS não funciona** (ex.: testando por `http://192.168.x.x`). No endereço publicado funciona.
- Fotos guardadas no aparelho ocupam espaço: Ajustes mostra o uso e avisa a partir de 70%.
- Um aparelho por obra: não há sincronização entre celulares nesta versão.


## Novidades da v0.2 (controle sem mexer em código)

- **Equipe**: adicionar, editar, desativar e excluir funcionários e funções.
- **Medição**: lance por dia a produção de cada serviço (e trecho).
- **Análises**: *Semana* (produção e produtividade), *Previsão* (ritmo dos últimos dias úteis → término da obra, comparação com o prazo e ritmo necessário), *Faltas* (por funcionário/período), *Materiais* (gasto estimado, saldo, quando pedir, quanto pedir).
- **Obra**: início, prazo final, dia de fechamento da medição e preço unitário por serviço (estimativa de medição antes do fechamento).

### Premissas dos cálculos
- Dias úteis = segunda a sexta, sem feriados; serviços avançam em paralelo.
- Ritmo = média por dia útil nos últimos N dias úteis (dias sem produção contam como zero).
- Consumo de material = produção × consumo por unidade × (1 + perda%). Concreto: espessura em metros (8 cm → 0,08 m³/m²).
- "Pedir até" = data em que o estoque acaba − antecedência de entrega do fornecedor.
- Os valores são estimativas para apoio à decisão, não substituem a medição oficial.


## Novidades da v0.3: diário, fotos e relatório

### Navegação
Abas: **Hoje · Chamada · Diário · Análises · Mais** (continua com 5). A **Medição** saiu da barra e fica no menu
**Mais** (primeiro item), no link "Lançar" dos cards de produção (Hoje e Diário) e nos atalhos da tela Hoje.
Tudo continua a no máximo 2 toques.

### Diário de obra (aba Diário)
- Um registro por dia, escolhido no seletor de data. **Salva sozinho** enquanto você digita ("Salvo ✓").
- Clima da manhã e da tarde, paralisação (com motivo), atividades realizadas, equipamentos em obra e
  ocorrências/observações.
- Mostra sozinho, sem digitar: **efetivo do dia** (vem da Chamada), **produção do dia** (vem da Medição) e as fotos.
- "Dias registrados": os dias com diário ou fotos. Dias úteis dos últimos 14 sem diário aparecem como **pendente**
  (a partir do início da obra, se ele estiver preenchido em Obra).

### Fotos
- **Tirar foto** abre a câmera; **Galeria** permite escolher várias. Dá para vincular a um serviço e a um trecho.
- Antes de salvar, a foto é reduzida (lado maior com até 1600 px, JPEG) e ganha uma miniatura, para caber muitas
  fotos no aparelho e a lista rolar leve.
- Guarda data e hora (a da câmera, quando o arquivo traz) e o **GPS** (uma leitura por lote). Fotos lançadas num dia
  anterior ficam sem GPS, porque a posição de agora não é a do local da foto.
- Toque na foto para ampliar, editar a legenda, trocar serviço/trecho, abrir "Ver no mapa" ou excluir.
- Mais → Fotos (ou Fotos → Todas): todas as fotos por dia, com filtro por serviço.

### Relatório (Diário → Gerar relatório)
- "Do dia" ou "Por período". Entram só os dias com diário preenchido ou fotos; o relatório traz apenas o que foi
  registrado (nada é inventado).
- **Imprimir / Salvar PDF**: na tela de impressão do iPhone, toque em Compartilhar → Salvar em Arquivos.
  Se a impressão não abrir no app instalado, use **Compartilhar arquivo** (um HTML com as fotos dentro, que o
  iPhone abre e imprime).
- Logo opcional no cabeçalho: Ajustes → Logo do relatório.

### Fluxo no iPhone (dia típico)
1. Hoje → **Tirar foto** ao longo do dia (ou Diário → Fotos do dia).
2. Chamada → marque a presença. Mais → Medição → lance a produção.
3. Diário → escreva as atividades e ocorrências. O efetivo e a produção já aparecem lá.
4. No fim da semana: Diário → Gerar relatório → Por período → Imprimir / Salvar PDF.
5. Ajustes → **Backup completo (com fotos)** e guarde o .zip fora do aparelho.
