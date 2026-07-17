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

- `posts`
- `categories`
- `trips`
- `banners`
- `testimonials`

Os documentos usam o campo numérico `id` e o mesmo valor como ID do documento.

## Regras iniciais sugeridas

Use regras restritas para escrita. Leitura pública pode ser liberada para conteúdo publicado.

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{document} {
      allow read: if resource.data.status == 'published' || request.auth != null;
      allow write: if request.auth != null;
    }

    match /categories/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    match /trips/{document} {
      allow read: if resource.data.status == 'active' || request.auth != null;
      allow write: if request.auth != null;
    }

    // Tags dos cards de viagem ("Poucas vagas restantes", etc).
    // Leitura pública: o site precisa delas para pintar o badge.
    match /tags/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    match /banners/{document} {
      allow read: if resource.data.status == 'active' || request.auth != null;
      allow write: if request.auth != null;
    }

    match /testimonials/{document} {
      allow read: if resource.data.status == 'approved' || request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

```txt
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/{fileName} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

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
