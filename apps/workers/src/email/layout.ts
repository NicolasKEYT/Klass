// Moldura visual dos e-mails transacionais do Klass. O mesmo desenho do e-mail
// de confirmação de cadastro (supabase/templates/confirmacao-cadastro.html), que
// o Supabase Auth envia: quem mudar um, confira o outro.
//
// Cores são as do tema claro de apps/web/src/index.css; e-mail não lê variável
// CSS. O logo é o quadrado preto com "K" da barra lateral, feito em HTML: sem
// imagem, não depende de hospedagem nem de o cliente liberar imagens.

/**
 * Escapa texto vindo do banco antes de colocá-lo no HTML. O nome do aluno nasce
 * num formulário público de cadastro; sem isso, alguém escreveria HTML num
 * e-mail com a marca do Klass.
 */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FONTE = "'IBM Plex Sans', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const FONTE_MONO = "'IBM Plex Mono', Menlo, Consolas, monospace";

// O degradê de uma cor só, junto do background-color, impede o modo escuro do
// Outlook de inverter o fundo do logo e do botão (preto com texto branco, que
// virava ilegível). Ver o comentário no template de confirmação de cadastro.
const PRETO = "#1A1A17";
const FUNDO_PRETO = `background-color:${PRETO}; background-image:linear-gradient(${PRETO},${PRETO});`;

interface OpcoesEmail {
  /** Resumo que aparece na lista da caixa de entrada, antes de abrir. */
  preheader: string;
  titulo: string;
  /** HTML do corpo. Quem chama escapa os dados com `escaparHtml`. */
  corpoHtml: string;
  botao?: { texto: string; url: string };
}

/** Parágrafo no estilo do corpo, para quem monta `corpoHtml`. */
export function paragrafo(html: string): string {
  return `<p style="margin:0 0 16px 0; color:#61635C; font-family:${FONTE}; font-size:16px; line-height:1.55;">${html}</p>`;
}

/** Texto em destaque dentro de um parágrafo. */
export function destaque(textoJaEscapado: string): string {
  return `<strong style="color:#1A1A17; font-weight:600;">${textoJaEscapado}</strong>`;
}

/** Caixa de código (por exemplo, o código de verificação do certificado). */
export function caixaDeCodigo(textoJaEscapado: string): string {
  return `<p style="margin:0 0 20px 0; padding:12px 14px; background-color:#E3E4DE; border-radius:8px; color:#1A1A17; font-family:${FONTE_MONO}; font-size:14px; line-height:1.5; word-break:break-all;">${textoJaEscapado}</p>`;
}

export function montarEmail({ preheader, titulo, corpoHtml, botao }: OpcoesEmail): string {
  const botaoHtml = botao
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px 0;">
        <tr>
          <td align="center" bgcolor="${PRETO}" style="${FUNDO_PRETO} border-radius:8px;">
            <a href="${escaparHtml(botao.url)}" style="display:inline-block; padding:14px 28px; color:#FFFFFF; font-family:${FONTE}; font-size:16px; font-weight:600; line-height:1.2; text-decoration:none; border-radius:8px;">${escaparHtml(botao.texto)}</a>
          </td>
        </tr>
      </table>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escaparHtml(titulo)}</title>
    <style>
      :root { color-scheme: light; supported-color-schemes: light; }
      @media only screen and (max-width: 520px) {
        .cartao { padding: 28px 20px !important; }
        .botao a { display: block !important; }
      }
    </style>
  </head>
  <body bgcolor="#F3F3F1" style="margin:0; padding:0; background-color:#F3F3F1;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; font-size:1px; line-height:1px; color:#F3F3F1;">${escaparHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F3F3F1" style="background-color:#F3F3F1;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
            <tr>
              <td style="padding:0 4px 20px 4px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="32" height="32" align="center" valign="middle" bgcolor="${PRETO}" style="width:32px; height:32px; ${FUNDO_PRETO} border-radius:8px; color:#FFFFFF; font-family:${FONTE}; font-size:16px; font-weight:600; line-height:32px;">K</td>
                    <td style="padding-left:10px; color:#1A1A17; font-family:${FONTE}; font-size:18px; font-weight:600;">Klass</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="cartao" bgcolor="#FFFFFF" style="background-color:#FFFFFF; border:1px solid #D8D9D3; border-radius:12px; padding:36px 32px;">
                <h1 style="margin:0 0 12px 0; color:#1A1A17; font-family:${FONTE}; font-size:24px; line-height:1.25; font-weight:600;">${escaparHtml(titulo)}</h1>
                ${corpoHtml}
                ${botaoHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 4px 0 4px;">
                <p style="margin:0; color:#6D6F68; font-family:${FONTE}; font-size:13px; line-height:1.5;">Klass · ERP educacional de código aberto</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
