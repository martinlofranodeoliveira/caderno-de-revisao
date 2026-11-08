# Dados locais e uso em mais de uma aba

O aplicativo armazena o caderno na chave `lofrano.caderno.v1`. Mantenha um backup exportado: armazenamento do navegador não substitui um arquivo sob seu controle.

Quando o navegador oferece **Web Locks**, uma única aba mantém a edição. Uma segunda aba abre somente para leitura, consulta, impressão e exportação. Feche a primeira aba e use **Tentar assumir edição** para editar na segunda. Esse bloqueio coordena as abas deste aplicativo na mesma origem; não controla extensões, outras aplicações ou alterações manuais no armazenamento.

Toda gravação também compara o valor atualmente salvo com a última versão lida ou gravada por esta aba. Um evento `storage` sinaliza alterações externas. Se o valor mudou, o aplicativo preserva o trabalho desta aba na memória e recusa substituir o arquivo salvo. **Exportar meu trabalho** baixa essa versão em memória. **Carregar versão salva** pede confirmação antes de descartar o trabalho em memória e abrir a versão atual. Cancelar preserva ambos. Uma versão salva inválida ou inacessível não substitui o trabalho em memória.

Sem Web Locks, essa comparação é uma **guarda otimista**, não uma transação atômica entre processos: duas gravações exatamente simultâneas ainda podem disputar o armazenamento. Edite em uma aba por vez. Nenhum conflito é resolvido pela mesclagem automática ou pelo descarte silencioso de uma versão.

Falhas de quota ou acesso mantêm as alterações na memória com aviso persistente e opção de exportar. Dados iniciais inválidos não são apagados automaticamente; o aplicativo oferece baixar o arquivo original e remover somente a própria chave mediante confirmação.
