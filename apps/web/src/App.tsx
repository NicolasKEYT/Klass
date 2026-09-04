import { Route, Routes } from "react-router-dom";
import { AuthProvider, Autenticado } from "@/auth";
import { AcessoNegado } from "@/pages/AcessoNegado";
import { Cadastrar } from "@/pages/Cadastrar";
import { Catalogo } from "@/pages/Catalogo";
import { DetalheTrilha } from "@/pages/DetalheTrilha";
import { Entrar } from "@/pages/Entrar";
import { Home } from "@/pages/Home";
import { Matriculas as MatriculasDoAluno } from "@/pages/aluno/Matriculas";
import { DetalheTurma as DetalheTurmaCoordenacao } from "@/pages/coordenacao/DetalheTurma";
import { EditarTrilha } from "@/pages/coordenacao/EditarTrilha";
import { NovaTrilha } from "@/pages/coordenacao/NovaTrilha";
import { NovaTurma } from "@/pages/coordenacao/NovaTurma";
import { Trilhas } from "@/pages/coordenacao/Trilhas";
import { Turmas as TurmasDaCoordenacao } from "@/pages/coordenacao/Turmas";
import { DetalheTurma as DetalheTurmaProfessor } from "@/pages/professor/DetalheTurma";
import { Turmas as TurmasDoProfessor } from "@/pages/professor/Turmas";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/cadastrar" element={<Cadastrar />} />
        <Route path="/acesso-negado" element={<AcessoNegado />} />
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
          path="/aluno/matriculas"
          element={
            <Autenticado papel="aluno">
              <MatriculasDoAluno />
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
      </Routes>
    </AuthProvider>
  );
}
