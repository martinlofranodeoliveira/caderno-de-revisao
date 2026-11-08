# Agenda de revisão

O Caderno usa uma versão pequena e explícita do sistema de caixas de Leitner. Ela serve para organizar datas; não mede a memória, não é FSRS e não promete melhora de aprendizagem.

| Caixa | Intervalo em dias |
| --- | ---: |
| 1 | 1 |
| 2 | 3 |
| 3 | 7 |
| 4 | 14 |
| 5 | 30 |

Um cartão novo começa na caixa 1, vencido na data em que foi criado. Na sessão, a resposta permanece oculta até a pessoa pedir para revelá-la.

- **Lembrei:** o cartão avança uma caixa, até a caixa 5. A próxima data usa o intervalo da **nova** caixa.
- **Repetir:** o cartão volta à caixa 1, com próxima revisão no dia seguinte.

Exemplo: um cartão novo revisado com “Lembrei” em 8 de novembro vai à caixa 2 e fica marcado para 11 de novembro. Repetir o mesmo cartão em uma revisão permitida marca o dia seguinte, sem conservar o intervalo maior.

Somente cartões com `due <= today` entram na sessão. Em empate de data, a ordem do baralho é preservada. O engine recusa uma revisão antecipada. Editar pergunta ou resposta preserva caixa, datas e quantidade de revisões.

## Datas e reprodutibilidade

O engine recebe `today` explicitamente em `YYYY-MM-DD`, usa o calendário Gregoriano e aceita anos de 1900 a 9999. Não lê relógio, fuso, armazenamento, DOM ou rede. Adicionar dias respeita mudanças de mês, ano e anos bissextos. Se a próxima revisão ultrapassar 9999-12-31, a operação é recusada.

O aplicativo escolhe a data corrente na camada de interface. A regra do engine é a mesma em qualquer fuso; não interpreta uma string flexível de data nem assume feriados ou dias úteis.

## Limites

Um cartão admite até um milhão de revisões registradas. A agenda não considera dificuldade, tempo de resposta, objetivo de prova ou hábitos pessoais. As avaliações são informadas pela pessoa e não verificadas pelo aplicativo. Se precisar estudar algo antes do prazo, consulte o cartão na biblioteca; a revisão agendada continua sujeita à regra de vencimento.
