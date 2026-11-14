# Newsletter da home

O formulário coleta nome, e-mail e autorização explícita, gravando na coleção
`newsletterSubscribers` do mesmo Firebase do site. A confirmação só aparece após
a gravação. Contatos não são salvos no cache local do navegador.

Os inscritos ficam em **Admin → Conteúdo do site → Newsletter**, com exportação
CSV para a ferramenta de disparo. O cadastro não envia e-mails automaticamente.

## Configuração antes da publicação

As regras ativas do Firestore não são versionadas neste repositório. Adicione o
bloco abaixo **dentro de `/databases/{database}/documents` nas regras existentes**,
preservando as regras das outras coleções. Não substitua o conjunto inteiro.

```text
match /newsletterSubscribers/{subscriberId} {
  function canManageNewsletter() {
    return request.auth != null
      && exists(/databases/$(database)/documents/users/$(request.auth.uid))
      && (
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
        || 'conteudo' in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('permissions', [])
      );
  }

  allow create: if request.resource.data.keys().hasAll(['name', 'email', 'consent', 'source', 'createdAt'])
    && request.resource.data.keys().hasOnly(['name', 'email', 'consent', 'source', 'createdAt'])
    && request.resource.data.name is string
    && request.resource.data.name.size() > 0
    && request.resource.data.name.size() <= 120
    && request.resource.data.email is string
    && request.resource.data.email.size() <= 254
    && request.resource.data.email.matches('[^\\s@]+@[^\\s@]+[.][^\\s@]+')
    && request.resource.data.consent == true
    && request.resource.data.source == 'home'
    && request.resource.data.createdAt == request.time;

  allow read, delete: if canManageNewsletter();
  allow update: if false;
}
```

O perfil do administrador precisa existir em `users/{uid}` com `role: 'admin'`;
editores precisam de `conteudo` em `permissions`. Revise regras genéricas que
permitam leitura pública de todas as coleções: permissões de regras sobrepostas
são cumulativas, portanto uma regra genérica permissiva exporia os contatos.

Depois de aplicar as regras, valide em homologação: cadastro válido, recusa de
campos inválidos, leitura anônima negada e consulta autenticada no painel.
Não foram aplicadas alterações nas regras remotas nem criados contatos de teste
na base de produção durante a implementação.
