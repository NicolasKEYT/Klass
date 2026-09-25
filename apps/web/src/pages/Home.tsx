import { PaginaAutenticada } from "@/components/PaginaAutenticada";
import { useAuth } from "@/auth";
import { Inicio as InicioAluno } from "@/pages/aluno/Inicio";
import { Hoje as HojeProfessor } from "@/pages/professor/Hoje";
import { Inicio as InicioCoordenacao } from "@/pages/coordenacao/Inicio";

// D3/D4 (klass-uikit.pdf) — a rota "/" é a mesma para os três papéis
// ("Início" para aluno e coordenação, "Hoje" para o professor — ver
// Navegação por papel), então o dispatch por papel acontece aqui, uma
// vez só, em vez de cada papel ter sua própria rota.
export function Home() {
  const { profile } = useAuth();
  // Largura ampla para o painel da coordenação (tabela densa de turmas);
  // as outras duas telas são mobile-first e cabem na largura padrão.
  const largura = profile?.papel === "coordenacao" ? "ampla" : "padrao";

  return (
    <PaginaAutenticada largura={largura}>
      {profile?.papel === "professor" && <HojeProfessor />}
      {profile?.papel === "coordenacao" && <InicioCoordenacao />}
      {(profile?.papel === "aluno" || !profile) && <InicioAluno />}
    </PaginaAutenticada>
  );
}
