---
version: 1
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: ["src/styles.css"]
---

# Biblioteca e sessão de revisão

Modo: **Operate**. Registro do estado construído em 8 de novembro de 2026; fonte primária em `src/App.jsx`, `src/styles.css` e nas sete capturas finais de `.impeccable/review/`. Esta superfície é code-led, sem comp aprovado. Perguntas opcionais ficaram sem resposta; público, direção e implementação são inferências da execução autônoma, não escolhas permanentes confirmadas do usuário.

A pessoa cria um baralho, escreve perguntas e respostas, encontra cartões, revisa os vencidos e leva os dados por backup. O momento central é revelar a resposta e escolher repetir ou avançar uma caixa. A faixa com cinco caixas torna a agenda visível sem atribuir uma nota ao aprendizado.

No desktop, cabeçalho baixo e índice lateral antecedem uma área ampla de trabalho; biblioteca e sessão compartilham o mesmo contexto. No celular, índice e backups precedem o conteúdo; baralhos viram uma faixa horizontal. Estado inicial, baralho vazio, busca sem resultado, revisão encerrada, formulário, confirmação e feedback de armazenamento têm representações explícitas. Não há rota de marketing nem painel de resultados de eficácia dentro deste target.

As ações principais são criar e editar, revelar e responder, exportar e importar. Backups são validados antes da substituição. Avisos distinguem falha de salvamento com trabalho em memória, dados locais inválidos, conflito de versão e acesso somente leitura por outra aba. A pessoa pode exportar antes de recarregar ou substituir. Exemplos são demonstrativos e opcionais. Conteúdo de cartões é texto simples do usuário.

Direção registrada no contrato da execução: **Quadro de aula e bandejas de revisão**, candidato 3, seed `33dbf561`. O comportamento assinatura já construído é pergunta com resposta inicialmente oculta, revelação breve e mudança de agenda após a escolha. O limite de expressão é manter tarefa, estado e controles reconhecíveis. Tokens e padrões reutilizáveis pertencem a `DESIGN.md`; este brief não cria uma composição nova.

Limites: armazenamento do navegador, sem conta ou servidor; o acesso exclusivo depende de Web Locks e tem fallback explícito. A implementação inclui impressão, teclado e redução de movimento, sem alegação de WCAG, paginação universal ou todos os navegadores. O parecer de acabamento informado é SHIP apenas para F1 (contagens/desempenho) e F2 (conflito entre abas), com 107 testes passando; não foi reexecutado por esta documentação. Nenhuma decisão opcional sem resposta foi promovida a preferência permanente.
