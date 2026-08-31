import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";

// Página de esqueleto: só prova que roteamento, Tailwind e o design
// system básico funcionam. As telas de persona entram em prompts
// seguintes.
export function Placeholder() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-klass-control bg-primary text-white">
          <span className="font-serif text-lg font-semibold">K</span>
        </div>
        <h1 className="font-serif text-klass-xl text-text-primary">Klass</h1>
        <p className="text-klass-base text-text-secondary">
          ERP educacional em construção. O esqueleto do monorepo, o design
          system e as integrações já estão de pé — as telas de cada módulo
          chegam nos próximos passos.
        </p>
        <Badge variant="live">em construção</Badge>
      </Card>
    </div>
  );
}
