import { Route, Routes } from "react-router-dom";
import { AuthProvider, Autenticado } from "@/auth";
import { SincronizacaoProvider } from "@/components/IndicadorSincronizacao";
import { AcessoNegado } from "@/pages/AcessoNegado";
import { Cadastrar } from "@/pages/Cadastrar";
import { Catalogo } from "@/pages/Catalogo";
import { DetalheModulo } from "@/pages/DetalheModulo";
import { DetalheTrilha } from "@/pages/DetalheTrilha";
import { Entrar } from "@/pages/Entrar";
import { Home } from "@/pages/Home";
import { VerificarCertificado } from "@/pages/VerificarCertificado";
import { Boletim } from "@/pages/aluno/Boletim";
import { Certificados as CertificadosDoAluno } from "@/pages/aluno/Certificados";
import { Certificados as CertificadosDaCoordenacao } from "@/pages/coordenacao/Certificados";
import { DetalheTurma as DetalheTurmaCoordenacao } from "@/pages/coordenacao/DetalheTurma";
import { EditarTrilha } from "@/pages/coordenacao/EditarTrilha";
import { EditarTurma } from "@/pages/coordenacao/EditarTurma";
import { NovaTrilha } from "@/pages/coordenacao/NovaTrilha";
import { NovaTurma } from "@/pages/coordenacao/NovaTurma";
import { Trilhas } from "@/pages/coordenacao/Trilhas";
import { Turmas as TurmasDaCoordenacao } from "@/pages/coordenacao/Turmas";
import { DetalheTurma as DetalheTurmaProfessor } from "@/pages/professor/DetalheTurma";
import { FazerChamada } from "@/pages/professor/FazerChamada";
import { Turmas as TurmasDoProfessor } from "@/pages/professor/Turmas";

export default function App() {
  return (
    <AuthProvider>
      {/* D13 — provedor único do indicador de sincronização, acima de
          todas as rotas: mantém o estado (e o listener de online/offline)
          vivo entre navegações, em vez de reiniciar a cada troca de tela. */}
      <SincronizacaoProvider>
      <Routes>
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/cadastrar" element={<Cadastrar />} />
        <Route path="/acesso-negado" element={<AcessoNegado />} />
        {/* Pública, sem <Autenticado>: verificação de certificado por hash. */}
        <Route path="/verificar/:hash" element={<VerificarCertificado />} />
        <Route
          path="/"
          element={
            <Autenticado>
              <Home />
            </Autenticado>
          }
        />
        <Route
          path="/catalogo"
          element={
            <Autenticado>
              <Catalogo />
            </Autenticado>
          }
        />
        <Route
          path="/catalogo/:slug"
          element={
            <Autenticado>
              <DetalheTrilha />
            </Autenticado>
          }
        />
        {/* D4 (klass-uikit.pdf) — "Detalhe de módulo/inscrição": tela
            dedicada por módulo, com pré-requisitos e escolha de turma,
            separada da visão geral da trilha. */}
        <Route
          path="/catalogo/:slug/modulos/:moduloId"
          element={
            <Autenticado>
              <DetalheModulo />
            </Autenticado>
          }
        />

        <Route
          path="/coordenacao/trilhas"
          element={
            <Autenticado papel="coordenacao">
              <Trilhas />
            </Autenticado>
          }
        />
        <Route
          path="/coordenacao/trilhas/nova"
          element={
            <Autenticado papel="coordenacao">
              <NovaTrilha />
            </Autenticado>
          }
        />
        <Route
          path="/coordenacao/trilhas/:slug/editar"
          element={
            <Autenticado papel="coordenacao">
              <EditarTrilha />
            </Autenticado>
          }
        />
        <Route
          path="/coordenacao/turmas"
          element={
            <Autenticado papel="coordenacao">
              <TurmasDaCoordenacao />
            </Autenticado>
          }
        />
        <Route
          path="/coordenacao/turmas/nova"
          element={
            <Autenticado papel="coordenacao">
              <NovaTurma />
            </Autenticado>
          }
        />
        <Route
          path="/coordenacao/turmas/:id"
          element={
            <Autenticado papel="coordenacao">
              <DetalheTurmaCoordenacao />
            </Autenticado>
          }
        />
        <Route
          path="/coordenacao/turmas/:id/editar"
          element={
            <Autenticado papel="coordenacao">
              <EditarTurma />
            </Autenticado>
          }
        />
        <Route
          path="/coordenacao/certificados"
          element={
            <Autenticado papel="coordenacao">
              <CertificadosDaCoordenacao />
            </Autenticado>
          }
        />

        {/* D3/D8 — "Minhas matrículas" virou "Boletim" (rota e nav). A tela
            agora agrupa por trilha e mostra cada módulo como card, com o
            módulo em andamento expandido inline — não navega mais para
            uma página de detalhe separada por matrícula. */}
        <Route
          path="/aluno/boletim"
          element={
            <Autenticado papel="aluno">
              <Boletim />
            </Autenticado>
          }
        />
        <Route
          path="/aluno/certificados"
          element={
            <Autenticado papel="aluno">
              <CertificadosDoAluno />
            </Autenticado>
          }
        />

        <Route
          path="/professor/turmas"
          element={
            <Autenticado papel="professor">
              <TurmasDoProfessor />
            </Autenticado>
          }
        />
        <Route
          path="/professor/turmas/:id"
          element={
            <Autenticado papel="professor">
              <DetalheTurmaProfessor />
            </Autenticado>
          }
        />
        <Route
          path="/professor/turmas/:id/aulas/:aula_id/chamada"
          element={
            <Autenticado papel="professor">
              <FazerChamada />
            </Autenticado>
          }
        />
      </Routes>
      </SincronizacaoProvider>
    </AuthProvider>
  );
}
