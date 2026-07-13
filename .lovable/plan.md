A rota `/auditoria-pubcore` já foi criada, mas o preview atual (`id-preview--*.lovable.app`) exige login do Lovable. Para gerar um link público acessível a qualquer pessoa (sem login), preciso publicar o projeto.

## Ação

1. Publicar o projeto no domínio `pubcore.lovable.app` (já é o slug atual).
2. Após a publicação, o link de auditoria ficará em:
   - `https://pubcore.lovable.app/auditoria-pubcore`
   - Também acessível via domínio próprio: `https://pubcore.site/auditoria-pubcore`

## Observações

- A rota é `noindex, nofollow` (não aparece no Google).
- Somente leitura, sem exposição de emails completos, tokens ou conteúdo sensível.
- Para desativar depois, basta remover o arquivo `src/routes/auditoria-pubcore.tsx` e o `src/lib/audit.functions.ts` e publicar novamente.

Aprove para eu publicar e te entregar o link final.