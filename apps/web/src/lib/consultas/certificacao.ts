import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  listarCertificadosDoAluno,
  listarTodosCertificados,
  trilhaTemCertificados,
  verificarPorHash,
} from "@/lib/certificacao";
import { chaves } from "./chaves";

// MS5 — Certificação.
export const opcoesCertificacao = {
  doAluno: (alunoId: string) =>
    queryOptions({
      queryKey: chaves.certificacao.doAluno(alunoId),
      queryFn: () => listarCertificadosDoAluno(alunoId),
    }),
  todos: () => queryOptions({ queryKey: chaves.certificacao.todos(), queryFn: listarTodosCertificados }),
  trilhaTemCertificados: (trilhaId: string) =>
    queryOptions({
      queryKey: chaves.certificacao.trilhaTemCertificados(trilhaId),
      queryFn: () => trilhaTemCertificados(trilhaId),
    }),
  verificacao: (hash: string) =>
    queryOptions({
      queryKey: chaves.certificacao.verificacao(hash),
      queryFn: () => verificarPorHash(hash),
    }),
};

export function useCertificadosDoAluno(alunoId: string | undefined) {
  return useQuery({ ...opcoesCertificacao.doAluno(alunoId ?? ""), enabled: !!alunoId });
}

export function useTodosCertificados() {
  return useQuery(opcoesCertificacao.todos());
}

export function useTrilhaTemCertificados(trilhaId: string | undefined) {
  return useQuery({ ...opcoesCertificacao.trilhaTemCertificados(trilhaId ?? ""), enabled: !!trilhaId });
}

export function useVerificacaoDeCertificado(hash: string | undefined) {
  return useQuery({ ...opcoesCertificacao.verificacao(hash ?? ""), enabled: !!hash });
}
