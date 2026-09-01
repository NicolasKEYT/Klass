import { Link } from "react-router-dom";
import { Card } from "@/components/Card";

export function AcessoNegado() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="flex max-w-sm flex-col items-center gap-3 text-center">
        <h1 className="font-serif text-klass-xl text-text-primary">Acesso negado</h1>
        <p className="text-body-sm text-text-secondary">
          Seu papel não tem permissão para ver esta página.
        </p>
        <Link to="/" className="text-body-sm font-medium text-primary hover:underline">
          Voltar para o início
        </Link>
      </Card>
    </div>
  );
}
