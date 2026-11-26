import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { useAuth } from "@/auth";

// "Esqueci minha senha": a pessoa informa o e-mail e recebe o link para criar
// uma senha nova (a tela do link é RedefinirSenha). A resposta é a mesma exista
// ou não uma conta com aquele e-mail: dizer "não encontramos" deixaria qualquer
// um descobrir quem tem conta no sistema.
export function EsqueciSenha() {
  const { pedirRedefinicaoDeSenha } = useAuth();
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await pedirRedefinicaoDeSenha(email.trim());
      setEnviadoPara(email.trim());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o link.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviadoPara) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
          <Badge variant="preenchido">verifique seu e-mail</Badge>
          <h1 className="text-klass-xl text-text-primary">Confira seu e-mail</h1>
          <p className="text-body-sm text-text-secondary">
            Se existir uma conta com <strong>{enviadoPara}</strong>, enviamos um link para criar
            uma nova senha. Ele expira em pouco tempo e só vale uma vez. Não chegou? Olhe também
            a caixa de spam.
          </p>
          <Link to="/entrar" className="text-body-sm font-medium text-primary hover:underline">
            Voltar para o login
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="flex w-full max-w-sm flex-col gap-5">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-klass-xl text-text-primary">Esqueci minha senha</h1>
          <p className="text-body-sm text-text-secondary">
            Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
          </p>
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

          {erro && <p className="text-body-sm text-danger">{erro}</p>}

          <Button type="submit" disabled={enviando} className="w-full">
            {enviando ? "Enviando..." : "Enviar link"}
          </Button>
        </form>

        <p className="text-center text-body-sm text-text-secondary">
          Lembrou a senha?{" "}
          <Link to="/entrar" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}
