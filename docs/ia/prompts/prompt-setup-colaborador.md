# Prompt — Configurar ambiente local do Klass

> Este prompt é para colar no Claude Code, dentro da pasta do repositório
> já clonado (`git clone https://github.com/NicolasKEYT/Klass.git`).
> Ele verifica pré-requisitos, instala dependências, configura o `.env`
> e sobe o projeto. **

---

## Keys do ENV
```
VITE_SUPABASE_URL=https://[REDIGIDO: ref do projeto Supabase].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[REDIGIDO: chave publicável]
```

---

## Instruções para o Claude Code executar

Você está ajudando um colaborador do projeto Klass a configurar o
ambiente local pela primeira vez. Siga os passos na ordem, confirmando
cada um antes de seguir para o próximo. Se algo falhar, pare e explique
o erro em vez de tentar contornar silenciosamente.

### 1. Confirmar que está na pasta certa

Verifique que o diretório atual é a raiz do repositório clonado
(deve conter `package.json`, `pnpm-workspace.yaml` e uma pasta `apps/`).
Se não estiver, pare e peça para o usuário navegar até a pasta correta
ou clonar o repositório primeiro.

### 2. Verificar Node.js

Rode `node -v`. É necessário Node 20 ou superior (idealmente 22, que é
o que o projeto usa em produção — confira o arquivo `.nvmrc` na raiz
para o valor exato).

- Se a versão já atender, siga em frente.
- Se não tiver Node instalado, ou a versão for antiga, **não tente
  instalar sozinho de forma invasiva** — explique ao usuário que ele
  precisa instalar Node 22+ (pelo site oficial nodejs.org, ou via nvm/
  Homebrew se já tiver uma dessas ferramentas) e pare aqui até ele
  confirmar que instalou.

### 3. Verificar e habilitar o pnpm

Rode `pnpm -v`. Se não existir:

```bash
corepack enable
```

Esse comando é seguro e vem embutido no Node 20+; não precisa de
permissão especial. Confirme depois com `pnpm -v` que funcionou.

### 4. Instalar as dependências do projeto

```bash
pnpm install
```

Isso pode levar um minuto na primeira vez. Confirme que terminou sem
erro antes de seguir.

### 5. Criar o arquivo `.env`

Verifique se já existe um `.env` na raiz. **Se já existir, não
sobrescreva** — avise o usuário e pergunte se quer manter o atual ou
substituir. Se não existir:

```bash
cp .env.example .env
```

### 6. Preencher o `.env` com os valores fornecidos

Edite o `.env` recém-criado e preencha estas duas variáveis com os
valores que estão no bloco "PREENCHER ANTES DE ENVIAR" no topo deste
documento:

```
VITE_SUPABASE_URL=<valor fornecido acima>
VITE_SUPABASE_ANON_KEY=<valor fornecido acima>
```

Não altere nenhuma outra variável do arquivo. Se o bloco no topo deste
documento estiver vazio (ninguém preencheu antes de enviar), **pare e
avise** — não invente nem deixe valores de exemplo no lugar.

### 7. Confirmar que o `.env` está protegido

Rode:

```bash
grep -n "^\.env" .gitignore
```

Deve retornar `.env` na lista. Se não retornar nada, **pare e avise o
usuário** antes de continuar — isso significa que o arquivo com as
chaves poderia ser commitado por engano.

### 8. Verificar identidade do Git

Rode:

```bash
git config user.name
git config user.email
```

Se qualquer um estiver vazio, pergunte ao usuário o nome completo e o
e-mail que ele usa no GitHub, e configure:

```bash
git config --global user.name "NOME QUE ELE DISSER"
git config --global user.email "EMAIL QUE ELE DISSER"
```

Use o e-mail cadastrado na conta do GitHub dele, para os commits
aparecerem vinculados ao perfil correto.

### 9. Explicar o fluxo de trabalho em branch

Antes de qualquer edição de código, explique ao usuário (em texto, não
precisa fazer nada no terminal ainda) que o projeto está próximo da
entrega e que mudanças não devem ir direto para a `main`. Oriente-o a
sempre criar uma branch antes de mexer em algo:

```bash
git checkout -b nome-descritivo-da-mudanca
```

E, ao terminar, enviar a branch e abrir um Pull Request no GitHub em
vez de fazer push direto na `main`:

```bash
git push origin nome-descritivo-da-mudanca
```

### 10. Subir o projeto

```bash
pnpm dev
```

Confirme pela saída do terminal que o servidor subiu (deve mostrar algo
como `Local: http://localhost:5173/`). Avise o usuário para abrir esse
endereço no navegador.

### 11. Informar as contas de teste

Mostre ao usuário estas três contas para ele logar e testar, uma por
papel:

- **Coordenação:** `coordenacao.teste@klass.dev` / `[REDIGIDO: senha de demonstração]`
- **Professor:** `professor.teste@klass.dev` / `[REDIGIDO: senha de demonstração]`
- **Aluno:** `aluno.teste@klass.dev` / `[REDIGIDO: senha de demonstração]`

Explique que esse banco é **compartilhado com o resto do time** — o que
ele criar ou mudar lá aparece para todo mundo, incluindo em produção.
Não é um ambiente isolado dele.

## Passo opcional — só se for mexer em schema do banco

Se o usuário for editar migrations ou qualquer coisa do schema do
Supabase (não apenas o código do frontend), ele vai precisar do
Supabase CLI configurado. **Não execute esta seção automaticamente** —
pergunte primeiro se ele realmente vai mexer em banco de dados, porque
isso exige que o Nicolas o adicione como colaborador no projeto Supabase
separadamente (é uma permissão diferente do acesso ao GitHub).

Se ele confirmar que vai mexer em schema:

```bash
brew install supabase/tap/supabase   # ou o método de instalação do SO dele
supabase login
supabase link --project-ref [REDIGIDO: ref do projeto Supabase]
```

Avise com todas as letras: **qualquer migration aplicada localmente com
`supabase db push` vai direto para o banco de produção compartilhado**
— não existe um banco de "teste" separado neste projeto. Qualquer
mudança de schema deveria ser combinada com o Nicolas antes de aplicar.

## Ao terminar

Resuma para o usuário, em poucas linhas: o que foi instalado, se o
`.env` ficou configurado corretamente, se o servidor subiu, e lembre
mais uma vez do fluxo de branch + Pull Request antes de qualquer commit.
