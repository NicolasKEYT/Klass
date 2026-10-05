// Formatação para a tela, em pt-BR e no fuso local do navegador: o banco
// guarda "8.5", "2026-06-20" e "15:00:00"; a interface mostra "8,5",
// "20/06/2026" e "15:00". Toda exibição de data, hora, nota e percentual
// passa por aqui — nenhuma tela formata por conta própria.
//
// Datas "AAAA-MM-DD" (colunas `date`) são datas de calendário, sem fuso:
// nunca passam por `new Date("AAAA-MM-DD")`, que as lê como meia-noite UTC
// e, no Brasil (UTC-3), mostraria o dia anterior. Já os `timestamptz`
// ("2026-06-20T18:30:00+00:00") são instantes e vão para o fuso local.

type DataEntrada = string | Date;

const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Converte data de calendário ou instante para um `Date` no fuso local. */
export function paraDataLocal(entrada: DataEntrada): Date {
  if (entrada instanceof Date) return entrada;
  const m = SO_DATA.exec(entrada);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(entrada);
}

/** `Date` → "AAAA-MM-DD" no fuso local (o formato que o banco espera). */
export function paraIsoLocal(data: Date): string {
  const d = String(data.getDate()).padStart(2, "0");
  const m = String(data.getMonth() + 1).padStart(2, "0");
  return `${data.getFullYear()}-${m}-${d}`;
}

function partes(entrada: DataEntrada): { dia: string; mes: string; ano: string } {
  const m = typeof entrada === "string" ? SO_DATA.exec(entrada) : null;
  if (m) return { ano: m[1], mes: m[2], dia: m[3] };
  const d = paraDataLocal(entrada);
  return {
    dia: String(d.getDate()).padStart(2, "0"),
    mes: String(d.getMonth() + 1).padStart(2, "0"),
    ano: String(d.getFullYear()),
  };
}

/** "2026-06-20" → "20/06/2026". */
export function formatarData(entrada: DataEntrada): string {
  const { dia, mes, ano } = partes(entrada);
  return `${dia}/${mes}/${ano}`;
}

/** "2026-06-20" → "20/06" (onde o ano é óbvio pelo contexto). */
export function formatarDiaMes(entrada: DataEntrada): string {
  const { dia, mes } = partes(entrada);
  return `${dia}/${mes}`;
}

/** "2026-06-20" → "06/2026". */
export function formatarMesAno(entrada: DataEntrada): string {
  const { mes, ano } = partes(entrada);
  return `${mes}/${ano}`;
}

/** "2026-06-20" → "01/08/2026 a 20/12/2026" para períodos. */
export function formatarPeriodo(inicio: DataEntrada, fim: DataEntrada, curto = false): string {
  const f = curto ? formatarDiaMes : formatarData;
  return `${f(inicio)} a ${f(fim)}`;
}

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIAS_LONGOS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-09-24" → "qui 24/09" (ou "qui 24/09/2026" com `comAno`). */
export function formatarDiaSemanaData(entrada: DataEntrada, comAno = false): string {
  const data = comAno ? formatarData(entrada) : formatarDiaMes(entrada);
  return `${DIAS_CURTOS[paraDataLocal(entrada).getDay()]} ${data}`;
}

/** "2026-09-24" → "Quinta-feira, 24 de setembro". */
export function formatarDataPorExtenso(entrada: DataEntrada): string {
  const d = paraDataLocal(entrada);
  return `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** "24 de setembro de 2026" (certificado). */
export function formatarDataLonga(entrada: DataEntrada): string {
  const d = paraDataLocal(entrada);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * Hora em 24 h, sem segundos: "15:00:00" (coluna `time`) → "15:00";
 * um instante (`Date` ou timestamptz) vira a hora local.
 */
export function formatarHora(entrada: DataEntrada): string {
  if (typeof entrada === "string" && /^\d{2}:\d{2}/.test(entrada)) return entrada.slice(0, 5);
  const d = paraDataLocal(entrada);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Instante → "24/09/2026 às 15:00". */
export function formatarDataHora(entrada: DataEntrada): string {
  return `${formatarData(entrada)} às ${formatarHora(entrada)}`;
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 2 dias"; depois de 30 dias, a data. */
export function formatarTempoRelativo(entrada: DataEntrada, agora: Date = new Date()): string {
  const minutos = Math.floor((agora.getTime() - paraDataLocal(entrada).getTime()) / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ontem";
  if (dias <= 30) return `há ${dias} dias`;
  return formatarData(entrada);
}

// Notas e médias são truncadas, nunca arredondadas: uma média 6,95 com
// mínimo 7,0 apareceria como "7,0" ao lado de "você não atingiu a média",
// contradizendo a regra de aprovação (que compara o valor real).
function truncarDecimal(valor: number, casasMax: number, casasMin: number): string {
  const fator = 10 ** casasMax;
  // O epsilon absorve o erro binário (8.3 * 100 = 829.9999…).
  const truncado = Math.floor(Math.abs(valor) * fator + 1e-6) / fator;
  const texto = truncado.toLocaleString("pt-BR", {
    minimumFractionDigits: casasMin,
    maximumFractionDigits: casasMax,
    useGrouping: false,
  });
  return valor < 0 && truncado !== 0 ? `-${texto}` : texto;
}

/** Nota: vírgula, ao menos 1 casa: 8 → "8,0", 6.5 → "6,5", 7.25 → "7,25". */
export function formatarNota(valor: number | string): string {
  return truncarDecimal(Number(valor), 2, 1);
}

/** Média: vírgula, até 2 casas, sem arredondar para cima: 6.95 → "6,95", 8.5 → "8,5", 8 → "8,0". */
export function formatarMedia(valor: number | string): string {
  return truncarDecimal(Number(valor), 2, 1);
}

/**
 * Percentual inteiro: 94.4 → "94%". Também truncado: 69,6% com mínimo de
 * 70% não pode aparecer como "70%".
 */
export function formatarPercentual(valor: number | string): string {
  return `${truncarDecimal(Number(valor), 0, 0)}%`;
}

/** Número decimal genérico com vírgula (pesos, por exemplo): 1.5 → "1,5". */
export function formatarDecimal(valor: number | string, casasMax = 2): string {
  return Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: casasMax, useGrouping: false });
}

/**
 * Lê o que o usuário digitou como nota/peso: aceita vírgula ou ponto
 * ("6,5" ou "6.5"). Devolve `null` se não for número.
 */
export function lerDecimal(texto: string): number | null {
  const limpo = texto.trim().replace(",", ".");
  if (limpo === "" || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(limpo)) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/**
 * O motivo de reprovação vem pronto do banco (diario.encerrar_matricula),
 * com números crus: "Média 6.9500000000000000 abaixo do mínimo 7.0 e
 * frequência 66.6666666666666667% abaixo do mínimo 70%". Aqui só os
 * números desse padrão são reescritos ("Média 6,95 abaixo do mínimo 7,0 e
 * frequência 66% …"); o texto livre de remoção fica como foi digitado.
 */
export function formatarMotivoConclusao(texto: string): string {
  return texto.replace(
    /\b(Média|mínimo|[Ff]requência) (\d+(?:\.\d+)?)(%?)/g,
    (_, rotulo: string, numero: string, pct: string) =>
      `${rotulo} ${pct ? formatarPercentual(numero) : formatarMedia(numero)}`,
  );
}
