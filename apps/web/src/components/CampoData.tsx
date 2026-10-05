import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/Input";
import { formatarData } from "@/lib/formato";

// Campo de data em DD/MM/AAAA (e de hora em HH:MM) — substitui o
// <input type="date"> nativo, que no Chrome em pt-BR é segmentado: ao
// digitar "1" no dia ele já pulava para o mês, então "12" virava dia 1 e
// mês 2; e o ano aceitava 5+ dígitos (20261). Aqui é um texto com máscara:
// as barras entram sozinhas, nada pula de campo, e a validação (data real,
// faixa de anos) aparece ligada ao campo. Para o resto do código o valor
// continua "AAAA-MM-DD" — a camada de dados e o banco não mudam.

const ANO_MIN = "2000-01-01";
const ANO_MAX = "2100-12-31";

/**
 * Máscara por segmentos: dígitos preenchem o segmento atual; ao completar
 * (ou ao digitar um separador) passa ao próximo e insere o separador.
 * Separador digitado com o segmento incompleto completa com zero à
 * esquerda ("1/" → "01/"). Ao apagar, não recoloca o separador do fim.
 */
function mascarar(entrada: string, anterior: string, tamanhos: number[], sep: string): string {
  const segmentos: string[] = [""];
  for (const c of entrada) {
    const i = segmentos.length - 1;
    const ultimo = i === tamanhos.length - 1;
    if (/\d/.test(c)) {
      if (segmentos[i].length >= tamanhos[i]) {
        if (ultimo) continue;
        segmentos.push(c);
      } else segmentos[i] += c;
    } else if (/[/.\-:\s]/.test(c) && !ultimo && segmentos[i] !== "") {
      segmentos[i] = segmentos[i].padStart(tamanhos[i], "0");
      segmentos.push("");
    }
  }
  let texto = segmentos.join(sep);
  const i = segmentos.length - 1;
  if (i < tamanhos.length - 1 && segmentos[i].length === tamanhos[i]) texto += sep;
  const apagando = entrada.length < anterior.length;
  if (apagando && texto.endsWith(sep) && !entrada.endsWith(sep)) texto = texto.slice(0, -1);
  return texto;
}

function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

/** "DD/MM/AAAA" → { iso } ou { erro } (texto vazio → iso ""). */
export function lerDataDigitada(
  texto: string,
  min = ANO_MIN,
  max = ANO_MAX,
): { iso: string; erro: string | null } {
  if (texto === "") return { iso: "", erro: null };
  const m = /^(\d{2})\/(\d{2})\/(\d+)$/.exec(texto);
  if (!m || m[3].length < 4) return { iso: "", erro: "Data incompleta. Use DD/MM/AAAA." };
  const [, dd, mm, aaaa] = m;
  const faixa = `Use um ano entre ${min.slice(0, 4)} e ${max.slice(0, 4)}.`;
  if (aaaa.length > 4) return { iso: "", erro: `Ano inválido: ${aaaa}. ${faixa}` };
  const dia = Number(dd);
  const mes = Number(mm);
  const ano = Number(aaaa);
  const diasNoMes = [31, ehBissexto(ano) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes[mes - 1]) {
    return { iso: "", erro: `A data ${texto} não existe.` };
  }
  const iso = `${aaaa}-${mm}-${dd}`;
  if (iso < min || iso > max) {
    return {
      iso: "",
      erro:
        min === ANO_MIN && max === ANO_MAX
          ? faixa
          : `Use uma data entre ${formatarData(min)} e ${formatarData(max)}.`,
    };
  }
  return { iso, erro: null };
}

/** "HH:MM" → { valor } ou { erro } (texto vazio → valor ""). */
export function lerHoraDigitada(texto: string): { valor: string; erro: string | null } {
  if (texto === "") return { valor: "", erro: null };
  const m = /^(\d{2}):(\d{2})$/.exec(texto);
  if (!m) return { valor: "", erro: "Hora incompleta. Use HH:MM (24 h)." };
  if (Number(m[1]) > 23 || Number(m[2]) > 59) return { valor: "", erro: `A hora ${texto} não existe.` };
  return { valor: texto, erro: null };
}

interface CampoBaseProps {
  rotulo: string;
  obrigatorio?: boolean;
  className?: string;
  /** Texto de ajuda sob o campo (fica no aria-describedby). */
  dica?: string;
}

interface MascaraProps<V> extends CampoBaseProps {
  valorExterno: string;
  /** Converte o valor de fora (ISO/HH:MM) no texto mostrado. */
  paraTexto: (valor: string) => string;
  ler: (texto: string) => { valor: V; erro: string | null };
  aoMudar: (valor: V) => void;
  /** Dígitos por segmento; o último pode aceitar a mais para acusar erro (ano 20261). */
  tamanhos: number[];
  /** Comprimento do texto completo: a partir dele o erro aparece sem esperar o blur. */
  tamanhoCompleto: number;
  sep: string;
  placeholder: string;
  sufixo?: (aplicar: (valor: string) => void) => ReactNode;
  comBotao?: boolean;
}

function CampoComMascara<V extends string>({
  rotulo,
  obrigatorio,
  className = "",
  dica,
  valorExterno,
  paraTexto,
  ler,
  aoMudar,
  tamanhos,
  tamanhoCompleto,
  sep,
  placeholder,
  sufixo,
  comBotao,
}: MascaraProps<V>) {
  const id = useId();
  const idDica = `${id}-dica`;
  const idErro = `${id}-erro`;
  const ref = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState(() => (valorExterno ? paraTexto(valorExterno) : ""));
  const [tocado, setTocado] = useState(false);
  // O que este campo mandou por último: se o valor de fora mudar para
  // outra coisa (formulário limpo, aula aberta para edição), o texto segue.
  const ultimoEmitido = useRef(valorExterno);

  useEffect(() => {
    if (valorExterno === ultimoEmitido.current) return;
    ultimoEmitido.current = valorExterno;
    setTexto(valorExterno ? paraTexto(valorExterno) : "");
    setTocado(false);
  }, [valorExterno, paraTexto]);

  const { erro: erroFormato } = ler(texto);
  const erro = erroFormato ?? (obrigatorio && texto === "" ? "Campo obrigatório." : null);
  // Enquanto digita não acusa "incompleto"; acusa ao sair do campo, ao
  // tentar enviar, ou quando o texto já tem o tamanho completo.
  const mostrarErro = !!erro && (tocado || texto.length >= tamanhoCompleto);

  // A validade nativa bloqueia o envio do formulário com data inválida.
  useEffect(() => {
    ref.current?.setCustomValidity(erroFormato ?? "");
  }, [erroFormato]);

  function aplicar(novoTexto: string) {
    setTexto(novoTexto);
    const { valor } = ler(novoTexto);
    ultimoEmitido.current = valor;
    aoMudar(valor);
  }

  const descricao = [dica ? idDica : null, mostrarErro ? idErro : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-label font-medium text-text-secondary">
        {rotulo}
      </label>
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          required={obrigatorio}
          value={texto}
          aria-invalid={mostrarErro || undefined}
          aria-describedby={descricao}
          onChange={(e) => aplicar(mascarar(e.target.value, texto, tamanhos, sep))}
          onBlur={() => setTocado(true)}
          onInvalid={() => setTocado(true)}
          className={`w-full font-mono tabular-nums ${comBotao ? "pr-12" : ""} ${mostrarErro ? "border-danger" : ""}`}
        />
        {sufixo?.((valor) => {
          aplicar(paraTexto(valor));
          setTocado(true);
          ref.current?.focus();
        })}
      </div>
      {dica && (
        <span id={idDica} className="text-label text-text-muted">
          {dica}
        </span>
      )}
      {mostrarErro && (
        <span id={idErro} className="text-label font-medium text-danger">
          {erro}
        </span>
      )}
    </div>
  );
}

interface CampoDataProps extends CampoBaseProps {
  /** "AAAA-MM-DD" ou "" (vazio/inválido). */
  valor: string;
  aoMudar: (iso: string) => void;
  /** Faixa aceita, em "AAAA-MM-DD"; padrão: anos 2000 a 2100. */
  min?: string;
  max?: string;
}

const temSeletorNativo =
  typeof HTMLInputElement !== "undefined" && "showPicker" in HTMLInputElement.prototype;

export function CampoData({ valor, aoMudar, min = ANO_MIN, max = ANO_MAX, ...base }: CampoDataProps) {
  const refCalendario = useRef<HTMLInputElement>(null);
  const valorValido = lerDataDigitada(valor ? formatarData(valor) : "", min, max).iso;
  return (
    <CampoComMascara<string>
      {...base}
      valorExterno={valor}
      paraTexto={formatarData}
      ler={(t) => {
        const r = lerDataDigitada(t, min, max);
        return { valor: r.iso, erro: r.erro };
      }}
      aoMudar={aoMudar}
      tamanhos={[2, 2, 6]}
      tamanhoCompleto={10}
      sep="/"
      placeholder="DD/MM/AAAA"
      comBotao={temSeletorNativo}
      sufixo={
        temSeletorNativo
          ? (aplicar) => (
              <>
                {/* Calendário opcional: o seletor nativo, aberto pelo botão.
                    Fica fora da ordem de foco; a digitação continua sendo
                    o caminho principal. */}
                <input
                  ref={refCalendario}
                  type="date"
                  tabIndex={-1}
                  aria-hidden
                  min={min}
                  max={max}
                  value={valorValido}
                  onChange={(e) => e.target.value && aplicar(e.target.value)}
                  className="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0"
                />
                <button
                  type="button"
                  aria-label={`Escolher ${base.rotulo.toLowerCase()} no calendário`}
                  onClick={() => {
                    try {
                      refCalendario.current?.showPicker();
                    } catch {
                      // Sem gesto válido ou navegador sem suporte: segue digitando.
                    }
                  }}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-klass-control text-text-secondary hover:text-text-primary"
                >
                  <CalendarDays className="h-4 w-4" aria-hidden />
                </button>
              </>
            )
          : undefined
      }
    />
  );
}

interface CampoHoraProps extends CampoBaseProps {
  /** "HH:MM" (ou "HH:MM:SS" vindo do banco) ou "". */
  valor: string;
  aoMudar: (hora: string) => void;
}

const horaParaTexto = (v: string) => v.slice(0, 5);

export function CampoHora({ valor, aoMudar, ...base }: CampoHoraProps) {
  return (
    <CampoComMascara<string>
      {...base}
      valorExterno={valor}
      paraTexto={horaParaTexto}
      ler={lerHoraDigitada}
      aoMudar={aoMudar}
      tamanhos={[2, 2]}
      tamanhoCompleto={5}
      sep=":"
      placeholder="HH:MM"
    />
  );
}
