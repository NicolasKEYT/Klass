import { Route, Routes } from "react-router-dom";
import { AuthProvider, Autenticado } from "@/auth";
import { AcessoNegado } from "@/pages/AcessoNegado";
import { Cadastrar } from "@/pages/Cadastrar";
import { Catalogo } from "@/pages/Catalogo";
import { DetalheTrilha } from "@/pages/DetalheTrilha";
import { Entrar } from "@/pages/Entrar";
import { Home } from "@/pages/Home";
import { EditarTrilha } from "@/pages/coordenacao/EditarTrilha";
import { NovaTrilha } from "@/pages/coordenacao/NovaTrilha";
import { Trilhas } from "@/pages/coordenacao/Trilhas";

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
      </Routes>
    </AuthProvider>
  );
}
