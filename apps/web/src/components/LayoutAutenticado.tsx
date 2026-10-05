import { Suspense, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Monitor } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Papel } from "@klass/types";
import { useAuth } from "@/auth";
import { EsqueletoPagina } from "@/components/Esqueleto";
import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { BarraInferior } from "@/components/navegacao/BarraInferior";
import { BarraLateral } from "@/components/navegacao/BarraLateral";
import { TiraSuperior } from "@/components/navegacao/TiraSuperior";
import { navPorPapel } from "@/components/navegacao/itensDeNavegacao";
import { prefetchCaminho } from "@/lib/consultas/prefetch";
import { opcoesSelecao } from "@/lib/consultas/selecao";
import { useRealtimeDoAluno, useRealtimeDoProfessor } from "@/lib/consultas/realtime";
import { useEhMobile } from "@/lib/useEhMobile";

// Casca comum das telas autenticadas, montada UMA vez (rota de layout com
// <Outlet/>): ao navegar, só a área de conteúdo troca — barra lateral,
// faixa superior e barra inferior continuam montadas, sem piscar. D3
// (klass-uikit.pdf) trocou o cabeçalho horizontal por barra lateral no
// desktop + barra inferior no celular (aluno/professor).
export function LayoutAutenticado() {
  const { usuario, profile } = useAuth();
  const location = useLocation();
  const ehMobile = useEhMobile();
  const papel = profile?.papel;

  // D3 — "no celular, a coordenação vê só o Início com as pendências;
  // gestão de turmas e trilhas é tarefa de desktop" (Moran/NN·g, 2019).
  // Em vez de redirecionar (o que perderia o estado de formulários em
  // andamento sem aviso), mostramos um recado honesto no lugar do
  // conteúdo — a tela continua existindo, só não é usável do celular.
  // Acompanhamento (gráficos, só leitura) também fica liberado: é o
  // "acompanhar" que o Início oferece no celular, um toque adiante.
  // /perfil: é por ele que a coordenação no celular chega ao seletor de
  // tema (avatar da faixa superior).
  const LIBERADAS_NO_MOBILE = ["/", "/coordenacao/acompanhamento", "/perfil"];
  const bloqueadoNoMobile =
    papel === "coordenacao" && ehMobile && !LIBERADAS_NO_MOBILE.includes(location.pathname);

  useRealtimeDoAluno(papel === "aluno" ? usuario?.id : undefined);
  useRealtimeDoProfessor(papel === "professor" ? usuario?.id : undefined);
  usePrefetchOcioso(usuario?.id, papel, papel === "coordenacao" && ehMobile);

  return (
    <div className="min-h-screen bg-background md:flex">
      <BarraLateral />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <TiraSuperior />
        {bloqueadoNoMobile ? (
          <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <Monitor className="h-8 w-8 text-text-muted" aria-hidden />
            <p className="max-w-xs text-body-sm text-text-secondary">
              Esta tela é feita para telas maiores. Gestão de turmas e trilhas é tarefa de
              computador — no celular, use o Início para acompanhar as pendências.
            </p>
            <Link to="/" className="text-body-sm font-medium text-primary hover:underline">
              Voltar ao Início
            </Link>
          </main>
        ) : (
          // Só telas pesadas carregam código sob demanda (edição de
          // trilha, com dnd-kit); o esqueleto fica na área de conteúdo.
          <Suspense
            fallback={
              <PaginaAutenticada>
                <EsqueletoPagina />
              </PaginaAutenticada>
            }
          >
            <Outlet />
          </Suspense>
        )}
      </div>
      <BarraInferior />
    </div>
  );
}

// Depois que a primeira tela terminou de carregar (nenhuma busca no ar),
// aproveita o navegador ocioso para pré-carregar as telas principais do
// papel (os itens da navegação). A primeira ida a elas já abre do cache.
function usePrefetchOcioso(usuarioId: string | undefined, papel: Papel | undefined, desligado: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!usuarioId || !papel || desligado) return;
    let cancelado = false;
    let temporizador: number | undefined;
    let ocioso: number | undefined;

    function preCarregar() {
      if (cancelado) return;
      for (const item of navPorPapel(papel)) {
        if (item.para && !item.aindaNaoExiste) prefetchCaminho(qc, item.para, { usuarioId: usuarioId!, papel });
      }
      // Professor: depois do Hoje, o próximo passo quase sempre é abrir uma
      // turma. Com o progresso em lote (uma RPC por turma), pré-carregar o
      // detalhe de cada turma ficou barato — vai numa segunda folga do
      // navegador, depois das telas da navegação.
      if (papel === "professor") {
        void qc
          .fetchQuery(opcoesSelecao.turmasDoProfessor(usuarioId!))
          .then((turmas) => {
            const preCarregarTurmas = () => {
              if (cancelado) return;
              for (const t of turmas) prefetchCaminho(qc, `/professor/turmas/${t.id}`, { usuarioId: usuarioId!, papel });
            };
            if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(preCarregarTurmas, { timeout: 5000 });
            else window.setTimeout(preCarregarTurmas, 1000);
          })
          .catch(() => undefined);
      }
    }
    function esperarPrimeiraTela() {
      if (cancelado) return;
      if (qc.isFetching() > 0) {
        temporizador = window.setTimeout(esperarPrimeiraTela, 300);
        return;
      }
      if (typeof window.requestIdleCallback === "function") ocioso = window.requestIdleCallback(preCarregar, { timeout: 3000 });
      else temporizador = window.setTimeout(preCarregar, 500);
    }
    temporizador = window.setTimeout(esperarPrimeiraTela, 300);

    return () => {
      cancelado = true;
      window.clearTimeout(temporizador);
      if (ocioso !== undefined) window.cancelIdleCallback(ocioso);
    };
  }, [qc, usuarioId, papel, desligado]);
}
