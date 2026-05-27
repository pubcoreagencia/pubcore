Diagnóstico encontrado:
- A tabela `checklist_tasks` aceita leitura/escrita e não há constraint de `priority` impedindo `Média`.
- Os GRANTs e RLS estão permitindo INSERT para a conta master/workspace atual.
- Já existe um card de teste inserido diretamente no banco (`TEST CARD DEBUG`), então o banco em si não parece bloquear a criação.
- Não houve request `POST` recente para `checklist_tasks` na sessão do usuário; isso indica que o clique/formulário provavelmente não está chegando até a chamada de insert, ou a UI está usando estado/contexto errado no Kanban embutido.

Plano de correção:
1. Reproduzir pelo fluxo da UI no preview para capturar o erro exato, verificando console e network no momento do clique em “Criar”.
2. Ajustar o formulário de criação do card em `src/routes/app.kanban.tsx` para impedir que o drag/pan horizontal do board intercepte cliques, teclado ou foco do formulário no modo embutido.
3. Tornar `createCard` mais robusto: validar coluna/funil ativo, usar valores compatíveis com a tabela, mostrar erro claro e fazer rollback/estado local consistente.
4. Se a reprodução revelar erro de RLS/DB específico, aplicar apenas a correção mínima necessária no banco via migration; se for UI/evento, manter a correção apenas no frontend.
5. Validar criando um card real pelo Kanban na página `/app/checklists` e confirmando que aparece no board e persiste no reload.