# Padrões da interface

Componentes reutilizáveis de `apps/web/src/components` que não são óbvios
pelo nome. Use estes antes de criar um novo.

## AvisoDePagina

Card centralizado com título, texto e uma única ação (botão ou `LinkBotao`).
Para telas que só dão um recado: página não encontrada, erro inesperado.

- `telaCheia`: fora da casca do layout (visitante sem login, erro acima das
  rotas), ocupa a tela inteira; sem ele, ocupa só a área de conteúdo.

## LimiteDeErro

Captura erro de renderização e mostra "Algo deu errado" com o botão
"Recarregar", em vez de tela branca. Está em dois lugares:

- em volta do `<Outlet/>` de `LayoutAutenticado`, com `key={location.pathname}`:
  a casca fica e trocar de rota limpa o erro;
- em volta de `<Routes>` em `App.tsx`, com `telaCheia`, como último recurso.

## Página não encontrada

Rota `*` em `App.tsx` (`pages/NaoEncontrada.tsx`). Logado, aparece dentro da
casca; sem login, aparece sozinha e **não** redireciona para `/entrar`.

## Headers de segurança

`apps/web/public/_headers` (Cloudflare Pages) é copiado sem mudança para
`dist/`. Sem CSP por enquanto.
