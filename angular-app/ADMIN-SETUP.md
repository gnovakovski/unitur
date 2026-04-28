# Painel Administrativo UNITUR - Documentação

## Estrutura Implementada

### 📁 Arquitetura de Pastas

```
src/app/
├── core/
│   ├── guards/
│   │   └── auth.guard.ts          # Proteção de rotas admin
│   ├── interceptors/
│   │   ├── auth.interceptor.ts    # Adiciona JWT token
│   │   └── http-error.interceptor.ts
│   ├── models/
│   │   ├── user.model.ts
│   │   ├── post.model.ts          # Interface de Posts
│   │   ├── trip.model.ts          # Interface de Viagens
│   │   ├── banner.model.ts        # Interface de Banners
│   │   └── testimonial.model.ts   # Interface de Depoimentos
│   └── services/
│       ├── api.service.ts
│       ├── auth.service.ts        # Autenticação JWT
│       ├── post.service.ts        # CRUD de Posts
│       ├── trip.service.ts        # CRUD de Viagens
│       ├── category.service.ts    # CRUD de Categorias
│       ├── banner.service.ts      # CRUD de Banners
│       ├── testimonial.service.ts # CRUD de Depoimentos
│       └── upload.service.ts      # Upload de imagens
│
└── features/
    └── admin/
        ├── layout/
        │   ├── admin-layout.component.ts    # Layout principal do admin
        │   ├── admin-layout.component.html
        │   └── admin-layout.component.scss
        ├── login/
        │   ├── login.component.ts           # Página de login
        │   ├── login.component.html
        │   └── login.component.scss
        ├── dashboard/
        │   ├── dashboard.component.ts       # Dashboard com estatísticas
        │   ├── dashboard.component.html
        │   └── dashboard.component.scss
        ├── posts/
        │   ├── posts-list.component.ts      # Listagem de posts
        │   ├── posts-list.component.html
        │   ├── posts-list.component.scss
        │   ├── post-form.component.ts       # Formulário criar/editar
        │   ├── post-form.component.html
        │   └── post-form.component.scss
        ├── viagens/
        │   └── viagens-list.component.ts    # Listagem de viagens
        ├── categorias/
        │   └── categorias-list.component.ts # Listagem de categorias
        ├── banners/
        │   └── banners-list.component.ts    # Listagem de banners
        └── depoimentos/
            └── depoimentos-list.component.ts # Listagem de depoimentos

shared/
└── components/
    ├── image-upload/
    │   ├── image-upload.component.ts    # Componente de upload
    │   ├── image-upload.component.html
    │   └── image-upload.component.scss
    └── loading/
        └── loading.component.ts         # Componente de loading
```

## 🚀 Funcionalidades Implementadas

### ✅ Autenticação
- **Login** com email e senha
- **JWT Token** armazenado no localStorage
- **Auth Guard** protegendo rotas /admin/*
- **Auth Interceptor** adicionando token em requisições
- **Logout** com limpeza de sessão

### ✅ Layout Administrativo
- **Sidebar** com menu de navegação
- **Topbar** com informações do usuário
- **Responsivo** (mobile e desktop)
- **Toggle** para abrir/fechar sidebar
- **Botão** para visualizar site público

### ✅ Dashboard
- **Cards de estatísticas** (Posts, Viagens, Depoimentos, Categorias)
- **Ações rápidas** para criar novo conteúdo
- **Design moderno** com animações

### ✅ Páginas de Listagem (Placeholder)
- Posts do Blog ✅ **CRUD COMPLETO**
- Viagens (placeholder)
- Categorias (placeholder)
- Banners (placeholder)
- Depoimentos (placeholder)

### ✅ CRUD de Posts (Modelo de Referência)
- **Listagem** com filtros (busca, categoria, status)
- **Paginação** completa
- **Formulário** de criação e edição
- **Upload de imagem** destacada (drag-and-drop)
- **Validações** em tempo real
- **Auto-geração** de slug a partir do título
- **Seleção** de categoria
- **Tags** separadas por vírgula
- **Viagens relacionadas** (multi-select)
- **Status** (rascunho/publicado)
- **Modal** de confirmação de exclusão
- **Estados** de loading e erro
- **Design responsivo**

## 🔐 Rotas Configuradas

### Públicas
- `/` - Home
- `/about` - Sobre
- `/blog` - Blog (listagem)
- `/blog/:slug` - Post individual

### Admin
- `/administrador` - Login do Admin
- `/admin/dashboard` - Dashboard
- `/admin/posts` - Listagem de Posts
- `/admin/posts/novo` - Criar Post
- `/admin/posts/:id/editar` - Editar Post
- `/admin/viagens` - Viagens
- `/admin/categorias` - Categorias
- `/admin/banners` - Banners
- `/admin/depoimentos` - Depoimentos

## 🎨 Design System

### Cores
```scss
$orange: #ff812c;  // Cor principal
$blue: #3a75c3;    // Cor secundária
$white: #FFFFFF;
$gray-light: #F8F9FA;
$gray: #6C757D;
$dark: #1a1a2e;
```

### Componentes
- Sidebar: 260px de largura
- Topbar: 70px de altura
- Border radius: 8px, 12px, 16px
- Shadows: 0 2px 8px, 0 8px 24px
- Transitions: 0.3s ease

## 🔧 Como Usar

### 1. Acessar o Admin
```
http://localhost:4200/administrador
```

### 2. Credenciais (Mock)
Por enquanto, o login está configurado para fazer requisição à API.
Você precisará:
- Configurar a URL da API em `auth.service.ts`
- Implementar o backend com endpoint `/auth/login`

### 3. Estrutura de Resposta Esperada
```typescript
{
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  user: {
    id: 1,
    name: "Admin",
    email: "admin@unitur.com",
    role: "admin"
  }
}
```

## 📝 Próximos Passos

### ✅ Fase 1 - CRUD de Posts (COMPLETO)
- [x] Implementar formulários de criação/edição
- [x] Adicionar validações
- [x] Implementar upload de imagens
- [x] Adicionar paginação nas listagens
- [x] Implementar busca e filtros
- [x] Criar serviço PostService completo
- [x] Componente ImageUpload reutilizável

### Fase 2 - Replicar para Outros Módulos
- [ ] Implementar CRUD de Viagens (usar Posts como referência)
- [ ] Implementar CRUD de Categorias
- [ ] Implementar CRUD de Banners
- [ ] Implementar CRUD de Depoimentos
- [ ] Adicionar tratamento de erros global
- [ ] Implementar cache quando apropriado

### Fase 3 - Melhorias UX
- [ ] Adicionar loading states
- [ ] Implementar toasts/notificações
- [ ] Adicionar confirmações em ações destrutivas
- [ ] Implementar drag-and-drop para reordenar
- [ ] Adicionar preview antes de publicar

### Fase 4 - Editor Rich Text
- [ ] Integrar TinyMCE ou CKEditor
- [ ] Configurar upload de imagens no editor
- [ ] Adicionar templates de conteúdo

### Fase 5 - Avançado
- [ ] Histórico de alterações
- [ ] Versionamento de conteúdo
- [ ] Agendamento de publicações
- [ ] Relatórios e analytics
- [ ] Permissões granulares

## 🔌 Integração com Backend

### Endpoints Necessários

#### Autenticação
```
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

#### Posts
```
GET    /api/posts
GET    /api/posts/:id
POST   /api/posts
PUT    /api/posts/:id
DELETE /api/posts/:id
```

#### Viagens
```
GET    /api/trips
GET    /api/trips/:id
POST   /api/trips
PUT    /api/trips/:id
DELETE /api/trips/:id
```

#### Categorias
```
GET    /api/categories
GET    /api/categories/:id
POST   /api/categories
PUT    /api/categories/:id
DELETE /api/categories/:id
```

#### Banners
```
GET    /api/banners
GET    /api/banners/:id
POST   /api/banners
PUT    /api/banners/:id
DELETE /api/banners/:id
```

#### Depoimentos
```
GET    /api/testimonials
GET    /api/testimonials/:id
POST   /api/testimonials
PUT    /api/testimonials/:id
PATCH  /api/testimonials/:id/approve
DELETE /api/testimonials/:id
```

#### Upload
```
POST /api/upload/image
```

## 🧪 Testando Localmente

### Sem Backend (Mock)
Para testar sem backend, você pode:

1. Modificar `auth.service.ts` para retornar dados mockados:
```typescript
login(credentials: LoginCredentials): Observable<AuthResponse> {
  // Mock response
  return of({
    token: 'mock-jwt-token',
    user: {
      id: 1,
      name: 'Admin',
      email: credentials.email,
      role: 'admin'
    }
  }).pipe(delay(1000));
}
```

2. Criar serviços mock para cada entidade

### Com Backend
1. Configure a URL da API em `environment.ts`
2. Implemente os endpoints listados acima
3. Configure CORS no backend
4. Teste as requisições

## 📚 Recursos Adicionais

### Bibliotecas Recomendadas
- **Angular Material** ou **PrimeNG** - Componentes UI
- **TinyMCE** ou **CKEditor** - Editor WYSIWYG
- **ng2-file-upload** - Upload de arquivos
- **ngx-toastr** - Notificações toast
- **@angular/cdk** - Drag and drop

### Instalação
```bash
# Angular Material
ng add @angular/material

# PrimeNG
npm install primeng primeicons

# TinyMCE
npm install @tinymce/tinymce-angular

# Toastr
npm install ngx-toastr
```

## 🐛 Troubleshooting

### Erro: "Cannot match any routes"
- Verifique se as rotas estão configuradas corretamente em `app.routes.ts`
- Certifique-se de que os componentes estão sendo importados corretamente

### Erro: "Token expired"
- Implemente refresh token
- Ou faça logout automático quando token expirar

### Erro: "CORS"
- Configure CORS no backend
- Adicione headers apropriados

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique a documentação
2. Consulte os requisitos em `.kiro/specs/admin-panel/requirements.md`
3. Revise o código dos componentes implementados

---

**Status**: ✅ CRUD de Posts Completo (Modelo de Referência)  
**Versão**: 1.1.0  
**Última Atualização**: Abril 2026

## 🎯 Modelo de Referência: CRUD de Posts

O CRUD de Posts foi implementado como **modelo de referência** para os demais módulos. Ele inclui:

### Componentes
1. **PostsListComponent** - Listagem com filtros e paginação
2. **PostFormComponent** - Formulário unificado para criar/editar
3. **ImageUploadComponent** - Componente reutilizável de upload

### Funcionalidades Implementadas
- ✅ Listagem com tabela responsiva
- ✅ Filtros (busca por título, categoria, status)
- ✅ Paginação completa
- ✅ Formulário de criação
- ✅ Formulário de edição (mesma rota)
- ✅ Upload de imagem com drag-and-drop
- ✅ Preview de imagem
- ✅ Validações em tempo real
- ✅ Auto-geração de slug
- ✅ Seleção de categoria
- ✅ Tags (separadas por vírgula)
- ✅ Viagens relacionadas (multi-select)
- ✅ Status (rascunho/publicado)
- ✅ Modal de confirmação de exclusão
- ✅ Estados de loading
- ✅ Tratamento de erros
- ✅ Design responsivo

### Como Usar como Referência
Para implementar os outros CRUDs (Viagens, Categorias, Banners, Depoimentos):

1. **Copie a estrutura** de posts-list e post-form
2. **Adapte os models** para a entidade específica
3. **Ajuste os campos** do formulário
4. **Reutilize** o ImageUploadComponent
5. **Mantenha** o mesmo padrão de design e UX

### Padrões Estabelecidos
- **Nomenclatura**: `[entidade]-list.component` e `[entidade]-form.component`
- **Rotas**: `/admin/[entidade]`, `/admin/[entidade]/novo`, `/admin/[entidade]/:id/editar`
- **Serviços**: Métodos CRUD padronizados (get, getAll, create, update, delete)
- **Filtros**: Sempre com debounce de 500ms
- **Paginação**: 10 itens por página
- **Validações**: Feedback visual imediato
- **Modais**: Confirmação para ações destrutivas
