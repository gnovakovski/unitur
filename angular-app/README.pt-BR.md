# Unitur - Agência de Viagens e Turismo

Uma aplicação Angular moderna para agência de viagens com design atraente e funcionalidades completas.

## � Design

O site utiliza uma paleta de cores vibrante e moderna:
- **Laranja**: #FF8C42 (principal)
- **Azul Céu**: #4A90E2 (secundário)
- **Branco**: #FFFFFF
- Gradientes e animações suaves

## ✨ Funcionalidades

### Home Page
- ✅ Banner com carrossel automático de imagens
- ✅ Barra de busca de viagens
- ✅ Cards de destinos populares com hover effects
- ✅ Seção de features/benefícios
- ✅ Depoimentos de clientes
- ✅ Call-to-action section
- ✅ Animações e transições suaves

### Header
- ✅ Logo animado
- ✅ Menu de navegação responsivo
- ✅ Botão de reserva destacado
- ✅ Menu hamburguer para mobile

### Footer
- ✅ Links organizados por categoria
- ✅ Redes sociais
- ✅ Informações de contato

## 🏗️ Estrutura do Projeto

```
src/app/
├── core/                    # Funcionalidades principais
│   ├── guards/             # Guards de rota
│   ├── interceptors/       # HTTP interceptors
│   ├── models/             # Interfaces e tipos
│   └── services/           # Serviços globais
├── features/               # Módulos de funcionalidades
│   ├── home/              # Página inicial com carrossel
│   └── about/             # Página sobre
├── layout/                 # Componentes de layout
│   ├── header/            # Cabeçalho moderno
│   └── footer/            # Rodapé completo
└── shared/                 # Componentes compartilhados
    ├── components/        # Componentes reutilizáveis
    ├── directives/        # Diretivas customizadas
    └── pipes/             # Pipes customizados
```

## 🚀 Como Executar

### Instalar dependências
```bash
cd angular-app
npm install
```

### Servidor de desenvolvimento
```bash
ng serve
```
Acesse `http://localhost:4200/`

### Build de produção
```bash
ng build
```

## 📦 Tecnologias

- Angular 21+
- TypeScript
- SCSS com variáveis e mixins
- Standalone Components
- Lazy Loading
- HTTP Client com Interceptors
- Animações CSS
- Responsive Design

## 🎯 Recursos Implementados

- ✅ Carrossel de imagens automático
- ✅ Animações de entrada (fade-in)
- ✅ Hover effects nos cards
- ✅ Gradientes modernos
- ✅ Design responsivo
- ✅ Menu mobile
- ✅ Imagens do Unsplash
- ✅ Ícones emoji
- ✅ Scrollbar customizada

## 🎨 Paleta de Cores

```scss
$orange: #FF8C42;        // Laranja principal
$orange-light: #FFB574;  // Laranja claro
$blue: #4A90E2;          // Azul céu
$blue-light: #7AB8F5;    // Azul claro
$white: #FFFFFF;         // Branco
```

## 📱 Responsividade

O site é totalmente responsivo e se adapta a:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (< 768px)

