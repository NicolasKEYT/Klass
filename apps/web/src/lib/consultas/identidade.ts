import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { listarPessoas } from "@/lib/identidade";
import { buscarAlunosPorNome } from "@/lib/painelCoordenacao";
import { listarProfessores } from "@/lib/selecao";
import { chaves } from "./chaves";

// MS1 — Identidade e Acesso: listas de pessoas usadas pela coordenação.
export const opcoesIdentidade = {
  professores: () =>
    queryOptions({ queryKey: chaves.identidade.professores(), queryFn: listarProfessores }),
  pessoas: () => queryOptions({ queryKey: chaves.identidade.pessoas(), queryFn: listarPessoas }),
  buscaAlunos: (termo: string) =>
    queryOptions({
      queryKey: chaves.identidade.buscaAlunos(termo),
      queryFn: () => buscarAlunosPorNome(termo),
      placeholderData: keepPreviousData,
    }),
};

export function useProfessores() {
  return useQuery(opcoesIdentidade.professores());
}

export function useBuscaDeAlunos(termo: string) {
  const termoLimpo = termo.trim();
  return useQuery({ ...opcoesIdentidade.buscaAlunos(termoLimpo), enabled: termoLimpo.length >= 2 });
}

export function usePessoas() {
  return useQuery(opcoesIdentidade.pessoas());
}
