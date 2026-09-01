import { Badge } from "@/components/Badge";
import { Cabecalho } from "@/components/Cabecalho";
import { Card } from "@/components/Card";
import { useAuth } from "@/auth";

// Só prova que o ciclo entrar → ler profile → mostrar dados funciona. As
// telas de verdade das personas chegam nos próximos módulos.
export function Home() {
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Cabecalho />
      <div className="flex min-h-[calc(100vh-theme(height.klass-header))] items-center justify-center p-6">
        <Card className="flex max-w-sm flex-col items-center gap-4 text-center">
          <h1 className="font-serif text-klass-xl text-text-primary">
            Olá, {profile?.nome_completo ?? "..."}!
          </h1>
          {profile && <Badge variant="success">{profile.papel}</Badge>}
        </Card>
      </div>
    </div>
  );
}
