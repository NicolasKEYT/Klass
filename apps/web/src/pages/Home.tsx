import { useAuth } from "@/auth";
import { Inicio as InicioAluno } from "@/pages/aluno/Inicio";
import { Hoje as HojeProfessor } from "@/pages/professor/Hoje";
import { Inicio as InicioCoordenacao } from "@/pages/coordenacao/Inicio";

// D3/D4 (klass-uikit.pdf) — a rota "/" é a mesma para os três papéis
// ("Início" para aluno e coordenação, "Hoje" para o professor — ver
// Navegação por papel), então o dispatch por papel acontece aqui, uma
// vez só, em vez de cada papel ter sua própria rota. Cada tela monta o
// próprio cabeçalho de página (sobrelinha e ações diferentes por papel).
export function Home() {
  const { profile } = useAuth();
  if (profile?.papel === "professor") return <HojeProfessor />;
  if (profile?.papel === "coordenacao") return <InicioCoordenacao />;
  return <InicioAluno />;
}
