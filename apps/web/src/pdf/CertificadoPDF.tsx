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
import type { Certificado } from "@klass/types";

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

// Não há entidade "instituição" no domínio — o nome vem do design (é o
// emissor do certificado, fixo no template), não do banco.
const INSTITUICAO = "Instituto Aberto de Tecnologia";
const CIDADE = "São Paulo";

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
    paddingTop: 44,
    paddingBottom: 30,
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
    marginTop: 30,
    fontFamily: SANS,
    fontSize: 15,
    color: COR.text,
  },
  nome: {
    marginTop: 18,
    fontFamily: SERIF_BOLD,
    fontSize: 40,
    color: COR.ink,
    textAlign: "center",
  },
  corpo: {
    marginTop: 20,
    fontFamily: SANS,
    fontSize: 16,
    color: COR.body,
    textAlign: "center",
    lineHeight: 1.5,
    maxWidth: 620,
  },
  selo: {
    marginTop: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  // Rodapé ancorado na base do cartão: data + código à esquerda,
  // assinatura à direita — como no SVG.
  rodape: {
    position: "absolute",
    left: 60,
    right: 60,
    bottom: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  data: {
    fontFamily: SANS,
    fontSize: 13,
    color: COR.text,
  },
  codigo: {
    marginTop: 6,
    fontFamily: MONO,
    fontSize: 12,
    color: COR.muted,
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

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function CertificadoPDF({ certificado }: { certificado: Certificado }) {
  // modulo_id preenchido = certificado de um módulo (escopo menor, sem a
  // ideia de "curso completo"); null = certificado da trilha inteira.
  const ehModulo = certificado.modulo_id !== null;
  const eyebrow = ehModulo ? "CERTIFICADO DE MÓDULO" : "CERTIFICADO DE CONCLUSÃO";

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
            <View style={styles.logo}>
              <Capelo cor={COR.cardBg} />
            </View>

            <Text style={styles.instituicao}>{INSTITUICAO}</Text>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <View style={styles.divisor} />

            <Text style={styles.certificamos}>Certificamos que</Text>
            <Text style={styles.nome}>{certificado.aluno_nome}</Text>

            {ehModulo ? (
              <Text style={styles.corpo}>
                concluiu com aproveitamento o módulo {certificado.modulo_nome} da trilha{" "}
                {certificado.trilha_nome}, com carga horária de {certificado.modulo_carga_horaria}{" "}
                horas, ministrado por {certificado.professor_nome}, cumprindo os requisitos de nota e
                frequência.
              </Text>
            ) : (
              <Text style={styles.corpo}>
                concluiu com aproveitamento o curso {certificado.trilha_nome}, com carga horária
                total de {certificado.trilha_carga_horaria_total} horas, cumprindo os requisitos de
                nota e frequência.
              </Text>
            )}

            {/* Selo: dois círculos concêntricos com o capelo ao centro. */}
            <View style={styles.selo}>
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
              <View>
                <Text style={styles.data}>
                  {CIDADE}, {formatarData(certificado.emitido_em)}
                </Text>
                {/* Hash público impresso no PDF (atributo 3 do MS5). */}
                <Text style={styles.codigo}>{certificado.hash_publico}</Text>
              </View>

              <View style={styles.assinaturaBloco}>
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
