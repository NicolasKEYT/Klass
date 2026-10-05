import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Path,
  Circle,
  G,
  StyleSheet,
} from "@react-pdf/renderer";
// Só o gerador da matriz (create): o QR é desenhado como vetor no próprio
// PDF, nítido na impressão e sem depender de canvas. Este módulo é
// carregado sob demanda junto com o react-pdf (ver gerarCertificado.tsx).
import { create as criarQr } from "qrcode";
import type { Certificado } from "@klass/types";
import { INSTITUICAO as DADOS_INSTITUICAO } from "@/lib/instituicao";
import { formatarDataLonga } from "@/lib/formato";

// Fidelidade ao design 06-certificado.svg. Uma decisão consciente: o SVG
// usa IBM Plex (Serif/Sans/Mono), mas registrar fontes customizadas no
// react-pdf exige buscar arquivos .ttf em runtime — frágil para um PDF
// que é gerado no cliente e deve valer offline. Como o próprio prompt
// autoriza cair nas fontes nativas quando as do design forem custosas,
// mapeamos Serif->Times, Sans->Helvetica, Mono->Courier. Layout, cores,
// proporções (A4 paisagem, ~1,41:1 como o 1200x850 do SVG) e hierarquia
// permanecem fiéis; só a família tipográfica é substituída.
const SERIF_BOLD = "Times-Bold";
const SANS = "Helvetica";
const MONO = "Courier";

// Cores do template do certificado (tokens cert.* do tailwind.config.ts,
// extraídos do 06-certificado.svg — pergaminho, sem o azul de marca).
const COR = {
  pageBg: "#F6F6F5",
  cardBg: "#FFFDF9",
  cardBorder: "#E7E2D6",
  ink: "#1B1A17",
  muted: "#8A8375",
  text: "#5C574C",
  body: "#3B382F",
  line: "#B7B0A0",
};

// Nome e cidade do emissor vêm de lib/instituicao (o mesmo da barra lateral).
const INSTITUICAO = DADOS_INSTITUICAO.nome;
const CIDADE = DADOS_INSTITUICAO.cidade;

// Lado do QR no PDF, em pontos (~19 mm): discreto no canto, mas ainda lido
// pela câmera de um celular a partir da folha impressa.
const LADO_QR = 54;
// Zona de silêncio exigida pela norma do QR (em módulos), para o leitor
// separar o código do resto da página.
const MARGEM_QR = 2;

// Matriz do QR desenhada como um único Path (um quadrado por módulo escuro).
function QrCode({ conteudo }: { conteudo: string }) {
  const { modules } = criarQr(conteudo, { errorCorrectionLevel: "M" });
  const n = modules.size;
  let d = "";
  for (let linha = 0; linha < n; linha++) {
    for (let coluna = 0; coluna < n; coluna++) {
      if (modules.get(linha, coluna)) {
        d += `M${coluna + MARGEM_QR} ${linha + MARGEM_QR}h1v1h-1z`;
      }
    }
  }
  const total = n + MARGEM_QR * 2;
  return (
    <Svg width={LADO_QR} height={LADO_QR} viewBox={`0 0 ${total} ${total}`}>
      <Path d={d} fill={COR.ink} />
    </Svg>
  );
}

// Ícone de capelo (mesmos paths do SVG) desenhado num viewBox 18x15, para
// reuso no logo do topo e no selo central.
function Capelo({ cor, escala = 1 }: { cor: string; escala?: number }) {
  return (
    <Svg width={18 * escala} height={15 * escala} viewBox="0 0 18 15">
      <G stroke={cor} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M9 3 L16.5 6.5 L9 10 L1.5 6.5 Z" />
        <Path d="M4.5 8 v4 a4.5 3 0 0 0 9 0 v-4" />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: COR.pageBg,
    padding: 24,
  },
  // Cartão externo com borda dupla, como o SVG (dois retângulos concêntricos).
  card: {
    flex: 1,
    backgroundColor: COR.cardBg,
    borderWidth: 1.5,
    borderColor: COR.cardBorder,
    borderRadius: 14,
    padding: 12,
  },
  innerBorder: {
    flex: 1,
    borderWidth: 1,
    borderColor: COR.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 60,
    paddingTop: 36,
    paddingBottom: 24,
    alignItems: "center",
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COR.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  instituicao: {
    marginTop: 16,
    fontFamily: SERIF_BOLD,
    fontSize: 19,
    color: COR.ink,
  },
  eyebrow: {
    marginTop: 12,
    fontFamily: SANS,
    fontSize: 13,
    color: COR.muted,
    letterSpacing: 2.4,
  },
  divisor: {
    marginTop: 10,
    width: 80,
    borderBottomWidth: 1,
    borderBottomColor: COR.muted,
  },
  certificamos: {
    marginTop: 24,
    fontFamily: SANS,
    fontSize: 15,
    color: COR.text,
  },
  nome: {
    marginTop: 14,
    fontFamily: SERIF_BOLD,
    fontSize: 40,
    color: COR.ink,
    textAlign: "center",
  },
  corpo: {
    marginTop: 16,
    fontFamily: SANS,
    fontSize: 16,
    color: COR.body,
    textAlign: "center",
    lineHeight: 1.5,
    maxWidth: 620,
  },
  // Código da turma congelado na emissão (só no certificado de módulo).
  turma: {
    marginTop: 8,
    fontFamily: SANS,
    fontSize: 12,
    color: COR.muted,
    letterSpacing: 0.6,
  },
  // Faixa de revogação no topo: o PDF de um certificado revogado (a
  // coordenação ainda pode abri-lo para conferência) não pode passar por
  // válido se for impresso.
  revogado: {
    position: "absolute",
    top: 14,
    right: 20,
    borderWidth: 1,
    borderColor: COR.ink,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontFamily: SANS,
    fontSize: 10,
    color: COR.ink,
    letterSpacing: 0.8,
  },
  selo: {
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  // Rodapé ancorado na base do cartão: verificação (QR + código + URL) à
  // esquerda, local/data e assinatura à direita. Desvio pequeno do SVG, que
  // tem só data + código à esquerda: o QR ocupa a altura que a data usava, e
  // ela sobe para cima da assinatura (o "local e data" de praxe).
  rodape: {
    position: "absolute",
    left: 60,
    right: 60,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  verificacao: {
    flexDirection: "row",
    alignItems: "center",
  },
  verificacaoTextos: {
    marginLeft: 10,
  },
  rotulo: {
    fontFamily: SANS,
    fontSize: 8,
    color: COR.muted,
    letterSpacing: 0.6,
  },
  codigo: {
    marginTop: 2,
    fontFamily: MONO,
    fontSize: 12,
    color: COR.text,
  },
  url: {
    marginTop: 4,
    fontFamily: SANS,
    fontSize: 8,
    color: COR.muted,
  },
  data: {
    fontFamily: SANS,
    fontSize: 13,
    color: COR.text,
    marginBottom: 22,
  },
  assinaturaBloco: {
    alignItems: "center",
  },
  assinaturaLinha: {
    width: 220,
    borderBottomWidth: 1,
    borderBottomColor: COR.line,
    marginBottom: 6,
  },
  assinaturaTexto: {
    fontFamily: SANS,
    fontSize: 13,
    color: COR.text,
  },
});

export function CertificadoPDF({
  certificado,
  urlVerificacao,
}: {
  certificado: Certificado;
  // URL completa de /verificar/<código>, impressa e codificada no QR.
  urlVerificacao: string;
}) {
  // modulo_id preenchido = certificado de um módulo (escopo menor, sem a
  // ideia de "curso completo"); null = certificado da trilha inteira.
  const ehModulo = certificado.modulo_id !== null;
  const eyebrow = ehModulo ? "CERTIFICADO DE CONCLUSÃO DE MÓDULO" : "CERTIFICADO DE CONCLUSÃO";
  // Professor e carga horária são congelados na emissão, mas a coluna aceita
  // null: o trecho some em vez de imprimir "null horas".
  const cargaModulo =
    certificado.modulo_carga_horaria !== null
      ? `, com carga horária de ${certificado.modulo_carga_horaria} horas`
      : "";
  const professor = certificado.professor_nome
    ? `, ministrado por ${certificado.professor_nome}`
    : "";

  return (
    <Document
      title={`Certificado ${certificado.hash_publico}`}
      author={INSTITUICAO}
      subject={
        ehModulo
          ? `Certificado de módulo — ${certificado.modulo_nome}`
          : `Certificado de conclusão — ${certificado.trilha_nome}`
      }
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.card}>
          <View style={styles.innerBorder}>
            {certificado.revogado_em && (
              <Text style={styles.revogado}>
                REVOGADO EM {formatarDataLonga(certificado.revogado_em).toUpperCase()} · SEM VALIDADE
              </Text>
            )}
            <View style={styles.logo}>
              <Capelo cor={COR.cardBg} />
            </View>

            <Text style={styles.instituicao}>{INSTITUICAO}</Text>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <View style={styles.divisor} />

            <Text style={styles.certificamos}>Certificamos que</Text>
            {/* Nome longo (acima de ~30 caracteres) quebraria em duas linhas a
                40pt e empurraria o selo sobre o rodapé com o QR: reduz o corpo. */}
            <Text
              style={
                certificado.aluno_nome.length > 30 ? [styles.nome, { fontSize: 30 }] : styles.nome
              }
            >
              {certificado.aluno_nome}
            </Text>

            {ehModulo ? (
              // O módulo vem antes e a trilha entra só como contexto ("parte
              // da trilha"), para o texto não sugerir a trilha inteira.
              <Text style={styles.corpo}>
                concluiu com aproveitamento o módulo {certificado.modulo_nome}, parte da trilha{" "}
                {certificado.trilha_nome}
                {cargaModulo}
                {professor}, cumprindo os requisitos de nota e frequência do módulo.
              </Text>
            ) : (
              <Text style={styles.corpo}>
                concluiu com aproveitamento o curso {certificado.trilha_nome}, com carga horária
                total de {certificado.trilha_carga_horaria_total} horas, cumprindo os requisitos de
                nota e frequência.
              </Text>
            )}

            {ehModulo && certificado.turma_codigo && (
              <Text style={styles.turma}>Turma {certificado.turma_codigo}</Text>
            )}

            {/* Selo: dois círculos concêntricos com o capelo ao centro. Com a
                linha da turma, sobe um pouco para não encostar no rodapé. */}
            <View style={ehModulo && certificado.turma_codigo ? [styles.selo, { marginTop: 8 }] : styles.selo}>
              <Svg width={84} height={84} viewBox="0 0 84 84">
                <Circle cx={42} cy={42} r={42} fill="none" stroke={COR.muted} strokeWidth={1.2} />
                <Circle cx={42} cy={42} r={34} fill="none" stroke={COR.muted} strokeWidth={0.8} />
                <G transform="translate(30, 34) scale(1.35)">
                  <Path
                    d="M9 3 L16.5 6.5 L9 10 L1.5 6.5 Z"
                    stroke={COR.muted}
                    strokeWidth={1.2}
                    fill="none"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M4.5 8 v4 a4.5 3 0 0 0 9 0 v-4"
                    stroke={COR.muted}
                    strokeWidth={1.2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </G>
              </Svg>
            </View>

            <View style={styles.rodape}>
              {/* Hash público impresso no PDF (atributo 3 do MS5), agora com
                  rótulo, URL em texto (para quem tem a folha impressa) e QR. */}
              <View style={styles.verificacao}>
                <QrCode conteudo={urlVerificacao} />
                <View style={styles.verificacaoTextos}>
                  <Text style={styles.rotulo}>Código de verificação</Text>
                  <Text style={styles.codigo}>{certificado.hash_publico}</Text>
                  <Text style={styles.url}>Verifique em {urlVerificacao}</Text>
                </View>
              </View>

              <View style={styles.assinaturaBloco}>
                <Text style={styles.data}>
                  {CIDADE}, {formatarDataLonga(certificado.emitido_em)}
                </Text>
                <View style={styles.assinaturaLinha} />
                <Text style={styles.assinaturaTexto}>Coordenação Acadêmica</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
