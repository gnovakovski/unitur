   # AngularApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.1.

## Pré-requisitos



Antes de começar, você precisa ter instalado em sua máquina:

- **Node.js** (versão 18.x ou superior) - [Download Node.js](https://nodejs.org/)
- **npm** (versão 11.9.0 ou superior) - já vem incluído com o Node.js
- **Angular CLI** (versão 21.2.1) - será instalado globalmente

## Como instalar e rodar o projeto

### 1. Instalar o Node.js

Baixe e instale o Node.js do site oficial: https://nodejs.org/

Para verificar se foi instalado corretamente, execute:

```bash
node --version
npm --version
```

### 2. Instalar o Angular CLI globalmente

```bash
npm install -g @angular/cli@21.2.1
```

### 3. Clonar o repositório

```bash
git clone <url-do-repositorio>
cd angular-app
```

### 4. Instalar as dependências do projeto

```bash
npm install
```

### 5. Rodar o projeto

```bash
ng serve
```

O projeto estará disponível em `http://localhost:4200/`

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
