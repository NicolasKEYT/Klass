import { Aviso } from "@/components/Aviso";

export function mensagemDoErro(erro: unknown, padrao: string): string {
  return erro instanceof Error && erro.message ? erro.message : padrao;
}

// Falha de leitura: o aviso de erro do design + "Tentar de novo", que
// refaz só a consulta que falhou. Nunca vira estado vazio — "nenhum X"
// significa que a leitura deu certo e não trouxe nada.
export function ErroConsulta({
  erro,
  padrao,
  tentarDeNovo,
  className = "",
}: {
  erro: unknown;
  padrao: string;
  tentarDeNovo: () => void;
  className?: string;
}) {
  return (
    <Aviso variant="danger" className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <span>{mensagemDoErro(erro, padrao)}</span>
      <button type="button" onClick={tentarDeNovo} className="font-medium underline underline-offset-2">
        Tentar de novo
      </button>
    </Aviso>
  );
}
