# Formato do backup e API

O backup é JSON UTF-8, versão 1. Os textos são simples: HTML e Markdown são conteúdo literal, não instruções executáveis. A importação não busca imagens, URLs ou outros arquivos.

```json
{
  "version": 1,
  "decks": [
    {
      "id": "exemplo",
      "title": "Geografia — exemplo fictício",
      "cards": [
        {
          "id": "brasil",
          "front": "Qual é a capital do Brasil?",
          "back": "Brasília.",
          "box": 1,
          "due": "2026-11-08",
          "lastReviewed": null,
          "reviews": 0
        }
      ]
    }
  ]
}
```

## Validação

- Somente as chaves mostradas são aceitas em cada nível; chaves desconhecidas ou JSON duplicadas são recusadas.
- IDs usam de 1 a 64 caracteres ASCII: letras, números, `_` e `-`.
- IDs de baralho são únicos. IDs de cartão são únicos dentro do próprio baralho.
- Títulos têm de 1 a 80 caracteres; pergunta e resposta, de 1 a 2.000. Espaços no início e no fim são removidos. Os limites contam pontos de código Unicode, não bytes ou unidades UTF-16.
- Controles C0, exceto tabulação e quebra de linha, DEL e surrogates isolados são recusados.
- Caixa deve ser um inteiro de 1 a 5; revisões, um inteiro de 0 a 1.000.000.
- Um cartão sem revisões tem caixa 1 e `lastReviewed: null`. Um cartão já revisado tem uma data em `lastReviewed`, que não pode ser posterior a `due`.
- Datas reais no formato `YYYY-MM-DD`, entre 1900-01-01 e 9999-12-31.
- Até 100 baralhos, 5.000 cartões ao todo, 8 MiB de backup e profundidade JSON de até 12.

Um BOM UTF-8 inicial é aceito. JSON malformado, comentários, vírgulas finais ou propriedades herdadas usadas como campos obrigatórios não são aceitos.

O limite de **8 MiB também vale para o estado normalizado completo**, medido no JSON canônico UTF-8 com dois espaços e LF final. Assim, todo estado válido pode ser exportado e importado novamente. Os limites de quantidade e de texto são máximos sujeitos a esse orçamento conjunto: não é possível lotar todos os cartões com o maior texto permitido se o backup ultrapassar 8 MiB. Uma alteração que ultrapassaria o orçamento é recusada com `LIMIT_EXCEEDED`, sem truncar, remover cartões ou modificar o estado anterior. A medição conta bytes UTF-8, inclusive caracteres multibyte e os escapes do JSON.

## API pura

Importe as funções de `src/engine.js`. Nenhuma delas modifica o estado recebido, gera IDs, lê o relógio ou acessa armazenamento.

| Função | Resultado |
| --- | --- |
| `createNotebook()` | Caderno vazio |
| `validateNotebook(value)` | Clone validado e normalizado |
| `addDeck(state, id, title)` | Estado com novo baralho |
| `renameDeck(state, id, title)` | Estado com título atualizado |
| `removeDeck(state, id)` | Estado sem o baralho e seus cartões |
| `upsertCard(state, deckId, {id, front, back}, today)` | Novo cartão ou edição que preserva a agenda |
| `removeCard(state, deckId, cardId)` | Estado sem o cartão |
| `dueCards(state, deckId, today)` | Clones dos vencidos, em ordem de revisão |
| `reviewCard(state, deckId, cardId, result, today)` | Estado após `remember` ou `again` |
| `serializeNotebook(state)` | JSON estável, dois espaços e LF final |
| `parseNotebook(text)` | Estado validado a partir de JSON |

## Erros

O erro previsto tem `.code` e não repete o texto do cartão.

| Código | Significado |
| --- | --- |
| `INVALID_DATA` | Forma, texto, ID, valor ou JSON inválido |
| `INVALID_DATE` | Data inválida, revisão antecipada ou cálculo fora do período permitido |
| `NOT_FOUND` | Baralho ou cartão inexistente |
| `DUPLICATE_ID` | ID repetido em um conjunto que exige unicidade |
| `LIMIT_EXCEEDED` | Limite de quantidade, revisões, bytes ou profundidade excedido |

Campos de texto exportados permanecem no backup. Não compartilhe o arquivo como se fosse anonimizado. A exportação não inclui hora de geração, caminhos, identificadores do dispositivo ou campos adicionais de rastreamento.
