import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { useAuth } from "@/auth";
import { SENHA_MINIMA } from "@/auth/senha";

export function Cadastrar() {
  const { cadastrar } = useAuth();
  const navigate = useNavigate();
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacaoSenha, setConfirmacaoSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [emailParaConfirmar, setEmailParaConfirmar] = useState<string | null>(null);

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (senha !== confirmacaoSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    setEnviando(true);
    try {
      const resultado = await cadastrar(email, senha, nomeCompleto);
      if (resultado.precisaConfirmarEmail) {
        setEmailParaConfirmar(email);
      } else {
        navigate("/");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a conta.");
    } finally {
      setEnviando(false);
    }
  }

  if (emailParaConfirmar) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
          <Badge variant="preenchido">verifique seu e-mail</Badge>
          <h1 className="text-klass-xl text-text-primary">Quase lá</h1>
          <p className="text-body-sm text-text-secondary">
            Enviamos um link de confirmação para <strong>{emailParaConfirmar}</strong>. Abra
            seu e-mail e confirme para poder entrar.
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
          <h1 className="text-klass-xl text-text-primary">Criar conta</h1>
          <p className="text-body-sm text-text-secondary">Comece sua jornada na Klass</p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={aoSubmeter}>
          <label className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-text-secondary">Nome completo</span>
            <Input
              autoComplete="name"
              required
              value={nomeCompleto}
              onChange={(e) => setNomeCompleto(e.target.value)}
            />
          </label>

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

          <label className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-text-secondary">Senha</span>
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={SENHA_MINIMA}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-text-secondary">Confirmar senha</span>
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={SENHA_MINIMA}
              value={confirmacaoSenha}
              onChange={(e) => setConfirmacaoSenha(e.target.value)}
            />
          </label>

          {erro && <p className="text-body-sm text-danger">{erro}</p>}

          <Button type="submit" disabled={enviando} className="w-full">
            {enviando ? "Criando conta..." : "Cadastrar"}
          </Button>
        </form>

        <p className="text-center text-body-sm text-text-secondary">
          Já tenho conta?{" "}
          <Link to="/entrar" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}
