import { Route, Routes } from "react-router-dom";
import { AuthProvider, Autenticado } from "@/auth";
import { AcessoNegado } from "@/pages/AcessoNegado";
import { Cadastrar } from "@/pages/Cadastrar";
import { Entrar } from "@/pages/Entrar";
import { Home } from "@/pages/Home";

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
      </Routes>
    </AuthProvider>
  );
}
