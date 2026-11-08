---
name: Caderno de Revisão
description: Sistema visual implementado para criar cartões e revisar perguntas no navegador.
colors:
  forest: "#173b33"
  forest-hover: "#285448"
  paper: "#f6f3e9"
  ink: "#19382f"
  muted: "#52675e"
  line: "#cdd2c5"
  yellow: "#edce83"
  yellow-hover: "#f6dc9e"
  surface: "#fffdf7"
  selected: "#e5eadb"
  selected-border: "#9eaf9a"
  nav-hover: "#eeeee2"
  field-border: "#aab7a8"
  focus: "#9a6810"
  board-secondary: "#34594b"
  board-secondary-hover: "#466d5b"
  board-action-ink: "#243a2b"
  board-muted: "#c1d1bf"
  warning-bg: "#fbebbe"
  warning-ink: "#503b0b"
  error-bg: "#f6ddd5"
  error-ink: "#7d2518"
  danger: "#a13624"
  danger-hover: "#852a1d"
typography:
  display:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "clamp(38px, 4.8vw, 64px)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "clamp(28px, 3vw, 42px)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.015em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "11px"
    fontWeight: 400
  question:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "clamp(26px, 3vw, 38px)"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.025em"
rounded:
  key: "4px"
  field: "6px"
  control: "8px"
  surface: "14px"
spacing:
  control-gap: "8px"
  action-gap: "12px"
  compact-inset: "18px"
  section-gap: "24px"
  region-gap: "28px"
  library-inset: "32px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "11px 18px"
  button-primary-hover:
    backgroundColor: "{colors.forest-hover}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "9px 4px"
  button-board-primary:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.board-action-ink}"
    rounded: "{rounded.control}"
    padding: "11px 18px"
  button-board-primary-hover:
    backgroundColor: "{colors.yellow-hover}"
  button-board-secondary:
    backgroundColor: "{colors.board-secondary}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "11px 18px"
  button-board-secondary-hover:
    backgroundColor: "{colors.board-secondary-hover}"
  button-destructive:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "11px 18px"
  button-destructive-hover:
    backgroundColor: "{colors.danger-hover}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px"
    width: "100%"
  deck-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "14px 10px"
    width: "100%"
  study-board:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.paper}"
    rounded: "{rounded.surface}"
    padding: "28px clamp(24px, 4vw, 52px) 24px"
  warning:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning-ink}"
    rounded: "{rounded.control}"
    padding: "16px 18px"
  modal:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "26px 30px 24px"
---

# Design System: Caderno de Revisão

## Overview

**Creative North Star: "Quadro de aula e bandejas de revisão"**

O sistema construído combina uma mesa clara de biblioteca com um quadro verde para a pergunta em estudo. Regras finas separam informações, os controles usam cantos discretos e a cor amarela destaca a decisão principal dentro da sessão. A expressão visual vem da organização, do contraste entre papel e quadro e do ícone linear de livro; não há textura de papel ou falso giz.

Este é um registro por extração, feito em 8 de novembro de 2026. A autoridade visual é o código de `src/styles.css` e `src/App.jsx`, confrontado com as sete capturas finais em `.impeccable/review/`: `desktop-empty.jpg`, `desktop-library.jpg`, `desktop-study.jpg`, `desktop-readonly.jpg`, `desktop-conflict.jpg`, `mobile-top.jpg` e `mobile-study.jpg`. O contrato `DIRECTION-CONTRACT.txt` da execução `continuacao-open-source-20261108` fornece o nome da direção. `PRODUCT.md` fornece apenas os compromissos duráveis pertinentes. A interface é code-led e não tem composição visual aprovada pelo usuário. Nome da direção e linguagem descritiva registram o que foi construído; perguntas opcionais permaneceram sem resposta e as decisões inferidas do mandato autônomo não são preferências permanentes do usuário.

A revisão de acabamento informou **SHIP** no escopo restrito de F1, contagens e desempenho, e F2, conflito entre abas, com 107 testes passando. Este documento não é uma nova auditoria e não certifica WCAG, impressão nem funcionamento em todos os navegadores. O objetivo e os estados desta superfície ficam no brief de `src/App.jsx`, separado das regras visuais reutilizáveis.

**Key Characteristics:**

- Papel quente, tinta verde escura e quadro de revisão com contraste invertido.
- DM Sans local em todos os papéis, sem uma segunda família de destaque.
- Biblioteca de linhas e divisórias, com concentração da cor no quadro de estudo.
- Cinco caixas em sequência e estados explícitos de armazenamento e acesso à edição.
- Movimento curto ao exibir conteúdo, removido com redução de movimento.

## Colors

A paleta usa verde como identidade principal, neutros quentes para leitura e amarelo para a ação de estudo e para avisos em tratamentos distintos. Os valores normativos estão no frontmatter; os nomes abaixo descrevem seus papéis observados.

### Primary

- **Verde de quadro — `forest`:** botões principais, marca de livro, estado ativo das abas e fundo da sessão. `forest-hover` é a resposta de hover dos botões principais.
- **Amarelo de decisão — `yellow`:** revelar e confirmar lembrança no quadro; também é usado na seleção de texto. `yellow-hover` acompanha o botão ao apontar.
- **Verde secundário do quadro — `board-secondary`:** ação de repetir; tem um hover próprio. O texto principal da ação amarela usa `board-action-ink`, enquanto os rótulos do quadro usam `board-muted`.

### Neutral

- **Papel — `paper`:** fundo da aplicação e texto sobre o verde; **superfície clara — `surface`:** diálogos e campos de formulário.
- **Tinta — `ink`:** títulos, corpo principal e ações de texto; **texto de apoio — `muted`:** descrições, agenda, contagens e notas.
- **Regra — `line`:** divisórias da biblioteca, caixas e cartões. `field-border` delimita campos e a busca.
- **Baralho selecionado — `selected` / `selected-border`:** preenchimento e contorno do item atual; `nav-hover` destaca outro baralho durante o apontamento.

Os estados semânticos não formam uma nova identidade: `warning-bg` / `warning-ink` assinalam armazenamento e acesso; `error-bg` / `error-ink` assinalam falhas; `danger` assinala exclusão e sua confirmação. O foco visível usa `focus` nas superfícies claras e `surface` nos dois botões do quadro. Esses sinais vêm acompanhados de texto, contorno, sublinhado ou estado nativo do controle.

**The Estado Explícito Rule.** Preserve a diferença visual entre aviso, falha e exclusão, mantendo a descrição e as ações de recuperação junto do estado.

## Typography

**Display Font / Body Font:** DM Sans, com fallback `sans-serif`. O arquivo local `/assets/dm-sans.woff2` é declarado para pesos de 400 a 700, com `font-display: swap`; não há dependência de fonte remota. Rótulos, botões e atalhos usam a mesma família.

A hierarquia nasce do tamanho, do peso e do espaçamento entre letras. O título inicial é mais amplo e leve que a marca; a pergunta no quadro mantém peso médio para textos que podem ocupar várias linhas. Não há uma progressão modular única declarada no CSS.

- **Display:** mensagem inicial vazia, com a escala fluida do token `display`; no celular fica em (42px).
- **Headline:** nome do baralho, com o token `headline`; no celular fica em (29px). A marca usa (21px, peso 700), reduzida a (18px).
- **Title:** pergunta na lista, com o token `title`. Respostas de lista usam `body`, largura máxima (68ch), quebras preservadas e quebra de palavras longas.
- **Question:** pergunta do quadro, com o token `question` e máximo (30ch) no desktop; no celular usa (29px) e deixa de limitar o número de caracteres por linha. A resposta usa (17px, entrelinha 1.7, máximo 66ch), passando a (16px) no celular.
- **Label:** agenda e apoio em (10–12px conforme o contexto), com contagens tabulares. A única identificação em caixa alta de destaque é o link institucional no cabeçalho, com espaçamento próprio.
- **Formulários:** títulos de diálogo em (25px, peso 600), rótulos em (14px, peso 700) e valores digitados em (16px, entrelinha 1.5). No celular o título do diálogo usa (23px).

## Layout

A área de trabalho tem largura máxima (1680px) e duas colunas no desktop: índice com (268px) e conteúdo flexível `minmax(0, 1fr)`. O cabeçalho tem altura mínima (82px), preenchimento (18px 40px) e uma divisória inferior. O índice usa preenchimento (32px 24px 24px); os backups ocupam sua região inferior. O conteúdo usa (28px `clamp(24px, 4vw, 64px)` 48px). O rodapé pertence ao fluxo normal da página; não existe barra fixa de ações.

A lista de cartões é vertical, com divisórias e preenchimento de linha (25px 0), sem grelha de cartões elevados. A busca e as ações compartilham uma linha no desktop. A sequência de caixas mantém cinco colunas iguais, separadas por regras verticais, com contagem, nome e intervalo visíveis. O quadro usa altura mínima (410px), preenchimento fluido e espaço entre pergunta e ações. Os valores de `spacing` extraem recorrências do CSS, não uma escala global nova.

- **Até 1100px:** índice reduzido para (228px); cabeçalho passa a preenchimento horizontal (24px), a nota do cabeçalho desaparece, o conteúdo usa (28px) nas laterais e a gestão do baralho fica abaixo do título. Rótulos de quantidade nas caixas quebram para uma segunda linha. Ações de estudo podem crescer em partes iguais.
- **Até 760px:** índice passa acima do conteúdo, em grelha compacta. Baralhos ocupam uma faixa horizontal rolável com largura (180px) por item. Título e explicação de backup são ocultos, mas exportação, importação e limite do arquivo permanecem. O conteúdo recebe (22px 18px 32px); a busca ocupa uma linha e as ações a seguinte; linhas de cartão passam a empilhar texto e ações. As cinco caixas continuam lado a lado. O quadro usa altura mínima (390px), preenchimento (22px 22px 19px), e os rótulos de atalho ficam ocultos. O rodapé passa a coluna.
- **Limite de layout declarado:** `body` tem largura mínima (320px). O código não define breakpoint em 740px nem promessa de suporte a todo viewport possível.

Diálogos usam largura total até (600px), altura máxima relativa a `100dvh` e rolagem interna; o afastamento do viewport passa de (24px) a (16px) no celular. A impressão possui um stylesheet próprio para perguntas e respostas, com margem de página (15mm), mas a presença dessa regra não comprova paginação em qualquer impressora ou navegador.

## Elevation & Depth

O padrão é plano: papel, diferenças de tom e regras finas fazem a separação. Biblioteca, linhas de cartões e quadro não recebem sombra. O diálogo é a exceção, com uma sombra (`0 18px 64px #071d1940`) sobre fundo de sobreposição (`#0c251cd9`). O quadro é uma superfície de conteúdo com contraste invertido, sem simulação de profundidade material.

**The Sombra de Diálogo Rule.** Reserve a sombra existente ao diálogo; não a espalhe pelas linhas da biblioteca ou pelas cinco caixas.

## Shapes

Controles e seleção de baralho usam o raio `control`; campos usam `field`; quadro e diálogo compartilham `surface`. As teclas de atalho têm raio `key`. A marca de livro é a exceção assimétrica observada, com cantos (4px 9px 9px 4px). Busca e divisórias permanecem retas. O pequeno contador da aba de revisão usa uma cápsula (12px), não uma família independente de chips.

Ícones são SVGs lineares locais, em geral (20 × 20px), com traço (1.8), pontas e junções arredondadas. Eles acompanham o nome da ação; ícones decorativos são ocultos da árvore de acessibilidade.

## Components

### Buttons

O botão principal é compacto e firme, com peso (700), altura mínima (44px), preenchimento definido no frontmatter e transição de fundo (`.15s ease-out`). O hover não é aplicado a controles desabilitados. Botões de texto têm fundo transparente, altura mínima (42px), peso (600) e sublinhado que aparece no hover. Exclusão aparece como ação textual vermelha e como botão vermelho na confirmação.

No quadro, amarelo serve para revelar ou avançar e verde secundário para repetir. Os dois possuem foco claro sobre o fundo escuro. O padrão de foco usa contorno (3px), deslocado (4px). Controles nativamente desabilitados usam opacidade (.5) e cursor `not-allowed`; não se deve inferir uma área de toque uniforme, pois há exceções menores em ações compactas e no botão de fechar.

### Inputs / Fields

Os campos de edição têm contorno fino, superfície clara, raio `field`, preenchimento do token e rótulo visível. Textareas permitem redimensionamento vertical. Dicas de comprimento ficam abaixo do campo. A busca é mais leve: fundo transparente, apenas regra inferior, ícone linear e nome acessível. Ambos compartilham foco visível e cor verde do cursor; erros são mensagens textuais, sem depender só de um contorno colorido.

### Navigation

O baralho selecionado tem preenchimento e borda próprios, título em negrito e `aria-current`. A contagem total e a quantidade para hoje ficam em uma segunda linha. A mudança para a faixa horizontal no celular conserva o item inteiro e o estado selecionado. As abas Cartões/Revisar usam sublinhado inferior (3px), peso (700), mínimo (48px) e contador discreto; não são botões preenchidos.

### Cards / Containers

Cartões da biblioteca são linhas abertas: pergunta, resposta, agenda e ações explícitas. Quebras de linha digitadas são preservadas. Estados de biblioteca vazia, baralho vazio e busca sem resultado usam título curto e orientação textual, mantendo as ações no lugar esperado. O primeiro acesso oferece criar baralho e exemplos demonstrativos opcionais.

### Sequência de caixas e quadro de revisão

As cinco caixas são uma faixa informativa ordenada, não controles clicáveis nem pontuação de aprendizagem. O quadro mostra posição da sessão e caixa atual, pergunta, resposta inicialmente oculta e ações. Revelar insere uma região de resposta separada por regra; não há virada tridimensional de cartão. A animação de chegada (`.18s cubic-bezier(.16, 1, .3, 1)`) usa opacidade e recorte, e todas as animações e transições são removidas em `prefers-reduced-motion: reduce`. Os botões permanecem equivalentes aos atalhos Espaço, 1 e 2.

### Feedback e proteção dos dados

Avisos ocupam a área acima do trabalho e podem aumentar sua altura no fluxo normal. Salvamento indisponível conserva o conteúdo em memória e oferece exportação. Conflito informa que o trabalho em memória não substituirá os dados salvos e oferece exportar ou carregar a versão salva. Esse conflito, isoladamente, não bloqueia a edição em memória. Com Web Locks, outra aba pode colocar esta em modo somente leitura: edição e revisão ficam desabilitadas; consulta, impressão e exportação continuam disponíveis. Um aviso permite tentar assumir a edição. Na ausência da API, a legenda orienta editar em uma aba por vez, sem afirmar bloqueio exclusivo.

Dados locais inválidos têm recuperação do conteúdo original e confirmação específica para removê-los. Importação validada apresenta quantidades e a consequência da substituição. Recarga avisa que descarta o trabalho em memória. Diálogos usam título associado, foco inicial, ciclo de Tab, Escape e retorno de foco ao acionador quando ele ainda existe. Essas são características implementadas; não equivalem a certificação de acessibilidade.

## Do's and Don'ts

### Do:

- **Do** conservar o papel como base de leitura e o verde como quadro de estudo, seguindo os tokens extraídos.
- **Do** usar a mesma DM Sans local e preservar a hierarquia entre pergunta, resposta, agenda e ação.
- **Do** manter as cinco caixas como sequência legível e as ações de revisão como botões com texto.
- **Do** conservar rótulos, foco visível, avisos de armazenamento e caminhos de exportação junto do estado relevante.
- **Do** testar a mudança do índice lateral para a faixa superior nos breakpoints reais antes de estender esta superfície.

### Don't:

- **Don't** tratar os nomes descritivos deste documento como aprovação de uma composição pelo usuário.
- **Don't** introduzir textura de papel, falso giz ou sombras em cada cartão como se fossem parte do sistema existente.
- **Don't** substituir a sequência funcional por um dashboard de eficácia ou métricas de aprendizagem inventadas.
- **Don't** representar conflito em memória e bloqueio de edição como o mesmo estado.
- **Don't** apresentar o stylesheet de impressão, os atributos acessíveis ou o parecer restrito como certificação universal.
