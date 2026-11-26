import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { useAuth } from "@/auth";

export function Entrar() {
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
      navigate("/");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="flex w-full max-w-sm flex-col gap-5">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-klass-xl text-text-primary">Entrar</h1>
          <p className="text-body-sm text-text-secondary">Acesse sua conta Klass</p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={aoSubmeter}>
          <label className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-text-secondary">E-mail</span>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <div className="flex flex-col">
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-text-secondary">Senha</span>
              <Input
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </label>
            {/* Fora do <label>: dentro dele o texto do link viraria parte do nome do campo. */}
            <Link
              to="/esqueci-senha"
              className="inline-flex h-12 items-center self-end text-label font-medium text-primary hover:underline sm:h-10"
            >
              Esqueci minha senha
            </Link>
          </div>

          {erro && <p className="text-body-sm text-danger">{erro}</p>}

          <Button type="submit" disabled={enviando} className="w-full">
            {enviando ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="text-center text-body-sm text-text-secondary">
          Não tem conta?{" "}
          <Link to="/cadastrar" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </p>
      </Card>
    </div>
  );
}
