# Firebase Setup

Este projeto usa o SDK oficial do Firebase para:

- Authentication: login do administrador.
- Firestore: posts, categorias, viagens, banners e depoimentos.
- Storage: upload de imagens.

## Configuração do app

No Firebase Console, crie um app Web e copie a configuração para:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

```ts
firebase: {
  apiKey: '...',
  authDomain: '...',
  projectId: '...',
  storageBucket: '...',
  messagingSenderId: '...',
  appId: '...'
}
```

## Coleções usadas no Firestore

- Conteúdo público: `trips`, `tags`, `posts`, `categories`, `banners`,
  `testimonials` e `siteContent` (header, contact, home, footer, about,
  exchangeRates).
- Privadas: `users` (perfis da equipe) e `newsletterSubscribers`.

### Regras do Storage e PDFs dos roteiros

As regras do bucket `unitur-e7882.firebasestorage.app` ficam em
[`storage.rules`](storage.rules), com configuração de publicação em `firebase.json`.
Use esse arquivo também ao publicar pelo console do Firebase.

As permissões de imagens existentes são preservadas. A exceção para PDF permite
criar e substituir somente `viagens/<id numérico>/<arquivo>.pdf`, com MIME
`application/pdf`, tamanho maior que zero e até 20 MB. O usuário precisa estar
autenticado e ter perfil ativo em `users/{uid}` no Firestore. A consulta exige
manter o papel **Firebase Rules Firestore Service Agent** já concedido à conta de
serviço do Storage.

Publique usando uma conta com acesso ao projeto:

```sh
firebase deploy --only storage --project unitur-e7882
```

Ou substitua o conteúdo de **Firebase Console → Storage → Rules** pelo arquivo
`storage.rules` e clique em **Publicar**. Salvar o arquivo localmente não muda
as regras em produção; o teste pelo site local também usa o bucket remoto.

Para validar as permissões nos emuladores, com Firebase CLI 14 e Java 17 ou
superior instalados:

```sh
npm run test:storage-rules
```

Esse teste utiliza apenas o projeto fictício `demo-unitur-storage`. A configuração
`firebase.storage-test.json` e as regras auxiliares de Firestore são exclusivas
dos testes e não devem ser publicadas em produção.

## CORS do Firebase Storage

Para permitir upload de imagens no site publicado, aplique o arquivo `storage-cors.json` no bucket do Storage:

```bash
gcloud auth login
gcloud config set project unitur-10034
gcloud storage buckets update gs://unitur-10034.firebasestorage.app --cors-file=storage-cors.json
```

Para conferir a configuracao ativa:

```bash
gcloud storage buckets describe gs://unitur-10034.firebasestorage.app --format="default(cors_config)"
```

Se o comando retornar `404`, confirme no console do Firebase se o Storage foi criado e se o bucket do projeto e `unitur-10034.firebasestorage.app`.
Se retornar `403`, a conta ativa do `gcloud` nao tem permissao de Storage Admin/Owner no projeto.
