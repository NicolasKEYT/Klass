import type { Config } from "tailwindcss";

// Tokens extraídos diretamente dos SVGs de design em `docs/design/`
// (exportados do Figma pela equipe). Nenhum valor foi estimado a olho —
// cada grupo abaixo indica de qual arquivo veio. As ambiguidades do
// bootstrap foram decididas e estão registradas nos comentários de cada
// token; raios de borda e letter-spacing ficaram como estavam por decisão
// explícita (sem divergência intencional confirmada ainda).
//
// Nenhum gradiente foi encontrado em nenhum dos seis SVGs.
// D1 — cores do tema vêm das variáveis --cor-* de index.css (claro e
// escuro), em canais RGB para o Tailwind aplicar opacidade (`bg-primary/10`).
// O hex ao lado de cada token é o valor do tema claro.
const cor = (nome: string) => `rgb(var(--cor-${nome}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Prompt 17 (klass-uikit.pdf, correção de fidelidade visual) —
        // paleta extraída por amostragem de pixel direto nas 7 telas de
        // alta-fidelidade (300dpi), não estimada a olho. O documento diz
        // que os WIREFRAMES de baixa-fidelidade são propositalmente cinza
        // ("a paleta sai depois", D15) — isso não se aplica às telas de
        // alta-fidelidade, que já usam esta paleta real e específica:
        // fundo quente muito claro, cards brancos com borda visível (sem
        // sombra), texto quase-preto, e UM único acento azul reservado
        // para o rádio de seleção de turma — em nenhum outro lugar.
        background: cor("background"), // #F3F3F1 — fundo de página — cinza claro e quente (medido)
        surface: cor("surface"), // #FFFFFF — cards, sidebar, inputs
        "surface-subtle": cor("surface-subtle"), // #E3E4DE — item ativo do menu, trilha de barra, avatar placeholder (medido)
        border: {
          DEFAULT: cor("border"), // #D8D9D3 — borda visível de card/badge — sem sombra de elevação (medido)
        },
        // Borda de controle de formulário — `border-controle` (input, select, textarea,
        // checkbox) e de badge de alerta. A borda de card é decorativa e
        // pode ser sutil; a de um campo identifica o controle, e a WCAG
        // 1.4.11 pede ≥ 3:1 contra o fundo adjacente: 3,64:1 no branco e
        // 3,28:1 no fundo da página (cálculo no QA de 2026-10-03). Mesmo
        // tom quente da paleta, só mais escuro.
        controle: cor("controle"), // #85877F
        text: {
          // "Preto/quase-preto" quente — não o cinza frio (#191A1C) de
          // antes da reforma. Repontado, não renomeado: todo uso de
          // text-primary/bg-primary já espalhado pelo código vira preto
          // automaticamente (ver `primary` abaixo).
          primary: cor("text-primary"), // #1A1A17
          secondary: cor("text-secondary"), // #61635C
          // Era #8B8D86 (3,4:1 no branco e 3,0:1 no fundo — abaixo do
          // mínimo de 4,5:1 da WCAG 1.4.3 para texto). Escurecido no mesmo
          // tom quente: 5,09:1 no branco e 4,58:1 no fundo. Fica muito
          // perto do secondary; a hierarquia passa a vir de tamanho/peso.
          muted: cor("text-muted"), // #6D6F68
        },
        // "primary" deixou de ser a marca azul: no UI Kit de alta-
        // fidelidade, todo botão/badge/estado "principal" (Concluído,
        // Matriculado, Ver boletim, item ativo da barra lateral) é preto
        // sólido — texto branco quando preenchido. Repontar aqui em vez
        // de trocar toda classe `bg-primary`/`text-primary`/`border-
        // primary`/`ring-primary` do código (o mesmo método já usado nos
        // tokens de tipografia no Prompt 16).
        primary: {
          DEFAULT: cor("primary"), // #1A1A17
          subtle: cor("primary-subtle"), // #E3E4DE — fundo de item ativo/selecionado (era azul clarinho)
          // Texto/ícone sobre o destaque preenchido (botão primário, badge
          // preenchido, barra de ações em lote). Era `text-white` fixo; no
          // tema escuro o destaque vira tinta clara e o texto, escuro.
          contraste: cor("primary-contraste"), // #FFFFFF
        },
        // Único azul do sistema inteiro — usado só no <input type="radio">
        // de "Escolha a turma" (accent-color), nunca em botão, link, badge
        // ou anel de foco (ver :focus-visible em index.css). Valor citado no próprio diagnóstico do PDF.
        acento: {
          DEFAULT: cor("acento"), // #0A84FF
        },
        // Traço de meta/mínimo nas barras contra meta (BarraDeMeta) — o
        // único lugar do sistema com um segundo acento colorido (não é
        // azul, então não conflita com a regra acima). Medido no traço de
        // "mínimo 75%" da tela Início do aluno.
        meta: {
          DEFAULT: cor("meta"), // #C2410C
        },
        // Véu atrás do modal. Era `bg-text-primary/40`; no escuro a tinta
        // do texto é clara e o véu clarearia a tela em vez de escurecê-la.
        veu: cor("veu"), // #1A1A17
        neutral: {
          subtle: cor("neutral-subtle"), // #E3E4DE — trilha de progress bar, badge neutro
        },
        // Mantidos só para feedback transitório (banners de sucesso/erro
        // do componente Aviso) — não aparecem em nenhuma das 7 telas de
        // alta-fidelidade revisadas neste prompt, então ficam fora do
        // escopo da correção visual (ver relatório do Prompt 17).
        success: {
          DEFAULT: cor("success"), // #15803D
          subtle: cor("success-subtle"), // #ECFDF3
        },
        danger: {
          DEFAULT: cor("danger"), // #B91C1C
          subtle: cor("danger-subtle"), // #FEE2E2
        },

        // Paleta do certificado (tela 06 — template de PDF, não é uma
        // tela navegável). Deliberadamente distinta: papel/pergaminho,
        // sem o preto/azul do app.
        cert: {
          bg: "#FFFDF9",
          border: "#E7E2D6",
          ink: "#1B1A17", // texto principal, nome do concluinte, selo
          muted: "#8A8375", // eyebrow, selo, código do certificado
          text: "#5C574C", // "Certificamos que", data, assinatura
          body: "#3B382F", // parágrafo de descrição do curso
          line: "#B7B0A0", // linha de assinatura
        },
      },

      fontFamily: {
        // As três famílias aparecem em todos os seis SVGs, sempre com a
        // mesma pilha de fallback.
        sans: ["IBM Plex Sans", "Segoe UI", "system-ui", "sans-serif"],
        serif: ["IBM Plex Serif", "Georgia", "serif"], // sem uso na interface desde os títulos sans (UI Kit); o certificado em PDF registra a própria fonte
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"], // dados numéricos: notas, contagens, códigos
      },

      fontSize: {
        // D2 (klass-uikit.pdf, Fundamentos) — escala tipográfica base 16,
        // razão ~1,25: 32/24/20/16/14px. Nenhum texto de interface fica
        // abaixo de 14px (metade dos professores brasileiros tem 46+ anos;
        // WCAG 2.5.8 e Material pedem corpo maior). Em vez de introduzir
        // nomes novos em ~60 arquivos, os tokens existentes foram
        // REPONTADOS para o valor mais próximo da nova escala — o nome do
        // token no código não mudou, só o valor renderizado.
        //
        // klass-2xs e text-caption saíam de circulação (9,5px e 11px,
        // nenhum uso no código) — removidos.
        //
        // As chaves NÃO levam o prefixo "text-": o Tailwind já prefixa
        // fontSize com "text-", então a chave "text-label" gerava
        // `.text-text-label` e as classes `text-label`/`text-body-sm` usadas
        // nas telas não produziam CSS nenhum (QA de 2026-10-02).
        label: ["14px", { lineHeight: "1.35" }], // D2 — metadado/legenda/rótulo (mínimo absoluto)
        "body-sm": ["16px", { lineHeight: "1.5" }], // D2 — corpo, célula de tabela

        "klass-md": ["16px", { lineHeight: "1.4", fontWeight: "500" }], // D2 — era 14px; nav, botão, valores de tabela
        "klass-lg": ["20px", { lineHeight: "1.3", fontWeight: "600" }], // D2 — era 16px; título de card
        "klass-2xl": ["24px", { lineHeight: "1.3", fontWeight: "600" }], // D2 — era 23px (0 usos); título de seção
        "klass-xl": ["32px", { lineHeight: "1.25", fontWeight: "600" }], // D2 — era 20px; título de página

        // Números de KPI (painel da coordenação, "82%", "6%"...) ficam
        // fora da escala de texto de interface — são display, não corpo —
        // e continuam no valor já calibrado.
        "klass-stat": ["28px", { lineHeight: "1.2", fontWeight: "600" }], // números de KPI — Início da coordenação

        "cert-eyebrow": [
          "13px",
          { lineHeight: "1.4", fontWeight: "600", letterSpacing: "2.4px" },
        ], // "CERTIFICADO DE CONCLUSÃO" — 06
        "cert-name": ["40px", { lineHeight: "1.2", fontWeight: "600" }], // nome do concluinte — 06
        "cert-title": ["19px", { lineHeight: "1.3", fontWeight: "600" }], // nome da instituição — 06
        "cert-body": ["16px", { lineHeight: "1.5" }], // parágrafo de descrição — 06
      },

      borderRadius: {
        // Consolidado a partir de valores observados de 6/7/8/9/10/12/16px.
        // 7px (inputs numéricos no diário) e 9–10px (ícones/perfil na
        // sidebar) ficam como ruído do design, mantidos nos tokens mais
        // próximos por decisão — revisitar se aparecer divergência
        // intencional nos próximos SVGs.
        "klass-badge": "6px", // badges de status em tabela
        "klass-control": "8px", // botões, inputs, selects, ícones
        "klass-card": "12px", // cards de conteúdo
        "klass-pill": "16px", // pills arredondadas ("tempo real", "Aberta"/"Fechada")
      },

      width: {
        "klass-sidebar": "260px", // largura fixa da sidebar — idêntica nas 5 telas de app
        "klass-painel": "380px", // painel lateral de detalhe (inscrição na turma da coordenação, pág. 11)
      },
      maxWidth: {
        // Teto da área de conteúdo ao lado da barra lateral (telas das pág.
        // 3, 9, 10 e 11 do UI Kit ocupam toda a largura útil). Antes o
        // conteúdo parava em 1024px e, em monitor grande, ficava numa
        // faixa estreita no meio da tela.
        "klass-conteudo": "1200px",
      },
      height: {
        "klass-header": "64px", // altura fixa do header — idêntica nas 5 telas de app
      },

      spacing: {
        "klass-card-x": "24px", // padding horizontal padrão dos cards (era 22px; +2 pra dar respiro na reforma flat)
        "klass-card-x-dense": "24px", // variante densa, uso pontual (ex.: card com headline maior) — 03
        "klass-card-y": "34px", // topo do card até o primeiro texto — 01, 02, 04, 05 (stat cards usam ~30px, a confirmar)
        "klass-gutter": "16px", // espaço entre cards do dashboard
        "klass-painel": "380px", // recuo do conteúdo quando o painel lateral está aberto (= largura do painel)
      },

      // Escala de sombra própria, calibrada para o visual flat/moderno
      // (referência: Linear/Stripe/Vercel). Blur maior + opacidade baixa,
      // na cor da tinta do texto (#191A1C) para não puxar cinza. Substitui
      // os shadow-md/lg genéricos do Tailwind — só três níveis. A tinta
      // vem de --cor-sombra: no escuro é preto puro, o único tom que ainda
      // se distingue de um fundo já escuro.
      boxShadow: {
        "klass-card": "0 1px 2px rgb(var(--cor-sombra) / 0.05), 0 4px 10px rgb(var(--cor-sombra) / 0.05)", // repouso dos cards
        "klass-hover": "0 2px 6px rgb(var(--cor-sombra) / 0.06), 0 8px 20px rgb(var(--cor-sombra) / 0.10)", // hover de superfície interativa
        "klass-elevated": "0 10px 32px rgb(var(--cor-sombra) / 0.16), 0 2px 8px rgb(var(--cor-sombra) / 0.07)", // modal / dropdown
      },
    },
  },
  plugins: [],
} satisfies Config;
