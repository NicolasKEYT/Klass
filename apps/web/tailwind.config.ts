import type { Config } from "tailwindcss";

// Tokens extraídos diretamente dos SVGs de design em `docs/design/`
// (exportados do Figma pela equipe). Nenhum valor foi estimado a olho —
// cada grupo abaixo indica de qual arquivo veio. As ambiguidades do
// bootstrap foram decididas e estão registradas nos comentários de cada
// token; raios de borda e letter-spacing ficaram como estavam por decisão
// explícita (sem divergência intencional confirmada ainda).
//
// Nenhum gradiente foi encontrado em nenhum dos seis SVGs.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta da interface do app (telas 01–05: dashboards de
        // coordenação, aluno e professor). Neutros frios + azul de marca.
        background: "#F6F6F5", // fundo do canvas atrás de sidebar/header
        surface: "#FFFFFF", // sidebar, cards, inputs
        "surface-subtle": "#FBFBFA", // faixa do header
        border: {
          DEFAULT: "#E7E7E3", // bordas de card, divisórias de tabela
        },
        text: {
          primary: "#191A1C",
          secondary: "#565860",
          muted: "#8B8D96",
        },
        primary: {
          DEFAULT: "#2563EB", // marca, links ativos, botão primário, barra de progresso
          subtle: "#EDF2FF", // fundo de item ativo no menu, avatar, badge "Aberta"
        },
        success: {
          DEFAULT: "#15803D", // texto de status positivo, indicador "tempo real"
          subtle: "#ECFDF3", // fundo de badge de status positivo
        },
        neutral: {
          subtle: "#F1F1EF", // trilha de progress bar, badge neutro ("Fechada")
        },
        // Inferida — não vem de nenhum SVG (nenhuma tela mostrou um estado
        // de erro/recusa). Reservada para estados negativos do domínio
        // (ex.: inscrição recusada, matrícula rejeitada).
        danger: {
          DEFAULT: "#DC2626",
          subtle: "#FEE2E2",
        },
        // D8/D15 (klass-uikit.pdf) — quinta cor semântica do vocabulário de
        // status ("atenção"), usada em estados que pedem cuidado mas não
        // são falha (chamada pendente, aluno abaixo da média, pendência da
        // coordenação). O PDF marca a paleta exata como "preenchida depois"
        // (D15, tom sóbrio); âmbar aqui é provisório, na mesma saturação de
        // success/danger para não destoar.
        warning: {
          DEFAULT: "#B45309",
          subtle: "#FEF3C7",
        },

        // Paleta do certificado (tela 06 — template de PDF, não é uma
        // tela navegável). Deliberadamente distinta: papel/pergaminho,
        // sem o azul de marca do app.
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
        serif: ["IBM Plex Serif", "Georgia", "serif"], // títulos de destaque
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
        "text-label": ["14px", { lineHeight: "1.35" }], // D2 — era 12px; metadado/legenda/rótulo (mínimo absoluto)
        "text-body-sm": ["16px", { lineHeight: "1.5" }], // D2 — era 13px; corpo, célula de tabela

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
      },
      height: {
        "klass-header": "64px", // altura fixa do header — idêntica nas 5 telas de app
      },

      spacing: {
        "klass-card-x": "24px", // padding horizontal padrão dos cards (era 22px; +2 pra dar respiro na reforma flat)
        "klass-card-x-dense": "24px", // variante densa, uso pontual (ex.: card com headline maior) — 03
        "klass-card-y": "34px", // topo do card até o primeiro texto — 01, 02, 04, 05 (stat cards usam ~30px, a confirmar)
        "klass-gutter": "16px", // espaço entre cards do dashboard
      },

      // Escala de sombra própria, calibrada para o visual flat/moderno
      // (referência: Linear/Stripe/Vercel). Blur maior + opacidade baixa,
      // na cor da tinta do texto (#191A1C) para não puxar cinza. Substitui
      // os shadow-md/lg genéricos do Tailwind — só três níveis:
      boxShadow: {
        "klass-card": "0 1px 2px rgba(25,26,28,0.05), 0 4px 10px rgba(25,26,28,0.05)", // repouso dos cards
        "klass-hover": "0 2px 6px rgba(25,26,28,0.06), 0 8px 20px rgba(25,26,28,0.10)", // hover de superfície interativa
        "klass-elevated": "0 10px 32px rgba(25,26,28,0.16), 0 2px 8px rgba(25,26,28,0.07)", // modal / dropdown
      },
    },
  },
  plugins: [],
} satisfies Config;
