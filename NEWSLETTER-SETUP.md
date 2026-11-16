# Newsletter da home

O formulário coleta nome, e-mail e autorização explícita, gravando na coleção
`newsletterSubscribers` do mesmo Firebase do site. A confirmação só aparece após
a gravação. Contatos não são salvos no cache local do navegador.

Os inscritos ficam em **Admin → Conteúdo do site → Newsletter**, com exportação
CSV para a ferramenta de disparo. O cadastro não envia e-mails automaticamente.

## Regras de acesso

A regra da coleção está em `firestore.rules` (já publicada em 16/11/2026):

- qualquer visitante cria uma inscrição, somente com `name`, `email`,
  `consent: true`, `source: "home"` e `createdAt` igual à hora do servidor;
- ninguém de fora lê, altera ou lista inscrições;
- quem tem papel admin ou o módulo `conteudo` lê e exclui pelo painel.

Validado em produção: inscrição anônima aceita; campo extra, leitura anônima e
alteração recusados. A inscrição de teste foi apagada em seguida.
