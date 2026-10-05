import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { AuthProvider, Autenticado } from "@/auth";
import { LayoutAutenticado } from "@/components/LayoutAutenticado";
import { carregarEditarTrilha } from "@/lib/consultas/prefetch";
import { AcessoNegado } from "@/pages/AcessoNegado";
import { Cadastrar } from "@/pages/Cadastrar";
import { Catalogo } from "@/pages/Catalogo";
import { DetalheModulo } from "@/pages/DetalheModulo";
import { DetalheTrilha } from "@/pages/DetalheTrilha";
import { Entrar } from "@/pages/Entrar";
import { Home } from "@/pages/Home";
import { Perfil } from "@/pages/Perfil";
import { VerificarCertificado } from "@/pages/VerificarCertificado";
import { Boletim } from "@/pages/aluno/Boletim";
import { Acompanhamento } from "@/pages/coordenacao/Acompanhamento";
import { Certificados as CertificadosDoAluno } from "@/pages/aluno/Certificados";
import { Certificados as CertificadosDaCoordenacao } from "@/pages/coordenacao/Certificados";
import { DetalheTurma as DetalheTurmaCoordenacao } from "@/pages/coordenacao/DetalheTurma";
import { EditarTurma } from "@/pages/coordenacao/EditarTurma";
import { NovaTrilha } from "@/pages/coordenacao/NovaTrilha";
import { NovaTurma } from "@/pages/coordenacao/NovaTurma";
import { Pessoas } from "@/pages/coordenacao/Pessoas";
import { Trilhas } from "@/pages/coordenacao/Trilhas";
import { Turmas as TurmasDaCoordenacao } from "@/pages/coordenacao/Turmas";
import { DetalheTurma as DetalheTurmaProfessor } from "@/pages/professor/DetalheTurma";
import { FazerChamada } from "@/pages/professor/FazerChamada";
import { Turmas as TurmasDoProfessor } from "@/pages/professor/Turmas";

// Única tela sob demanda: a edição de trilha traz o dnd-kit (arrastar
// módulos). As demais ficam no pacote principal — carregá-las sob demanda
// poria um download no meio de cada navegação. O hover em "Editar" já
// baixa este código (ver prefetch.ts).
const EditarTrilha = lazy(() => carregarEditarTrilha().then((m) => ({ default: m.EditarTrilha })));

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/cadastrar" element={<Cadastrar />} />
        <Route path="/acesso-negado" element={<AcessoNegado />} />
        {/* Públicas, sem <Autenticado>: verificação de certificado por hash
            (destino do QR do PDF) e o campo para digitar um código. */}
        <Route path="/verificar" element={<VerificarCertificado />} />
        <Route path="/verificar/:hash" element={<VerificarCertificado />} />

        {/* Rota de layout: a guarda de autenticação roda uma vez e a casca
            (barra lateral, faixa superior, barra inferior) fica montada
            entre as navegações; só o <Outlet/> troca. */}
        <Route
          element={
            <Autenticado>
              <LayoutAutenticado />
            </Autenticado>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/catalogo/:slug" element={<DetalheTrilha />} />
          {/* D4 (klass-uikit.pdf) — "Detalhe de módulo/inscrição": tela
              dedicada por módulo, com pré-requisitos e escolha de turma,
              separada da visão geral da trilha. */}
          <Route path="/catalogo/:slug/modulos/:moduloId" element={<DetalheModulo />} />
          {/* D3 — Perfil (nome, papel, e-mail, Sair): barra inferior do
              professor e menu do usuário do aluno. */}
          <Route path="/perfil" element={<Perfil />} />

          <Route element={<Autenticado papel="coordenacao" />}>
            <Route path="/coordenacao/trilhas" element={<Trilhas />} />
            <Route path="/coordenacao/trilhas/nova" element={<NovaTrilha />} />
            <Route path="/coordenacao/trilhas/:slug/editar" element={<EditarTrilha />} />
            <Route path="/coordenacao/turmas" element={<TurmasDaCoordenacao />} />
            <Route path="/coordenacao/turmas/nova" element={<NovaTurma />} />
            <Route path="/coordenacao/turmas/:id" element={<DetalheTurmaCoordenacao />} />
            <Route path="/coordenacao/turmas/:id/editar" element={<EditarTurma />} />
            <Route path="/coordenacao/certificados" element={<CertificadosDaCoordenacao />} />
            <Route path="/coordenacao/pessoas" element={<Pessoas />} />
            {/* D11 — gráficos de acompanhamento; entrada pelo Início. */}
            <Route path="/coordenacao/acompanhamento" element={<Acompanhamento />} />
          </Route>

          {/* D3/D8 — "Minhas matrículas" virou "Boletim" (rota e nav). A tela
              agora agrupa por trilha e mostra cada módulo como card, com o
              módulo em andamento expandido inline — não navega mais para
              uma página de detalhe separada por matrícula. */}
          <Route element={<Autenticado papel="aluno" />}>
            <Route path="/aluno/boletim" element={<Boletim />} />
            <Route path="/aluno/certificados" element={<CertificadosDoAluno />} />
          </Route>

          <Route element={<Autenticado papel="professor" />}>
            <Route path="/professor/turmas" element={<TurmasDoProfessor />} />
            <Route path="/professor/turmas/:id" element={<DetalheTurmaProfessor />} />
            <Route path="/professor/turmas/:id/aulas/:aula_id/chamada" element={<FazerChamada />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
