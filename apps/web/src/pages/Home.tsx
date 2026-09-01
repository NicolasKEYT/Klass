import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/auth";

// Só prova que o ciclo entrar → ler profile → mostrar dados → sair
// funciona. As telas de verdade das personas chegam nos próximos módulos.
export function Home() {
  const { profile, sair } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="flex max-w-sm flex-col items-center gap-4 text-center">
        <h1 className="font-serif text-klass-xl text-text-primary">
          Olá, {profile?.nome_completo ?? "..."}!
        </h1>
        {profile && <Badge variant="success">{profile.papel}</Badge>}
        <Button variant="secondary" onClick={() => void sair()}>
          Sair
        </Button>
      </Card>
    </div>
  );
}
