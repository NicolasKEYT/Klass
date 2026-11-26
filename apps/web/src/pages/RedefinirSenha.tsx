import { useState, type FormEvent } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { LinkBotao } from "@/components/LinkBotao";
import { SENHA_MINIMA } from "@/auth/senha";
import { useAuth } from "@/auth";

// Destino do link do e-mail de "Redefinir senha" (o pedido é EsqueciSenha). O
// Supabase abre este endereço já com uma sessão de recuperação, e a única coisa
// que ela permite é gravar a senha nova.
//
// Só mostra o formulário a quem chegou pelo link (`emRecuperacao`). Quem apenas
// está logado, ou abriu o endereço à mão, troca a senha pelo Perfil, que exige a
// senha atual. Link vencido, já usado ou aberto em outro navegador cai em "link
// inválido", com a saída de pedir outro.

const MENSAGEM_DE_LINK_INVALIDO =
  "O link para redefinir a senha expira em pouco tempo e só pode ser usado uma vez.";

function CartaoCentralizado({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="flex w-full max-w-sm flex-col gap-5">{children}</Card>
    </div>
  );
}

export function RedefinirSenha() {
  const { usuario, carregando, emRecuperacao, definirNovaSenha } = useAuth();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [concluida, setConcluida] = useState(false);

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }

    setEnviando(true);
    try {
      await definirNovaSenha(senha);
      setConcluida(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a nova senha.");
    } finally {
      setEnviando(false);
    }
  }

  if (concluida) {
    return (
      <CartaoCentralizado>
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-klass-xl text-text-primary">Senha alterada</h1>
          <p className="text-body-sm text-text-secondary">
            Pronto: sua nova senha já vale. Você está com a conta aberta.
          </p>
        </div>
        <LinkBotao to="/" className="w-full">
          Ir para o início
        </LinkBotao>
      </CartaoCentralizado>
    );
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body-sm text-text-secondary">
        Verificando o link...
      </div>
    );
  }

  if (!usuario || !emRecuperacao) {
    return (
      <CartaoCentralizado>
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-klass-xl text-text-primary">Link inválido ou expirado</h1>
          <p className="text-body-sm text-text-secondary">{MENSAGEM_DE_LINK_INVALIDO}</p>
        </div>
        <LinkBotao to="/esqueci-senha" className="w-full">
          Pedir um novo link
        </LinkBotao>
      </CartaoCentralizado>
    );
  }

  return (
    <CartaoCentralizado>
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-klass-xl text-text-primary">Defina uma nova senha</h1>
        <p className="text-body-sm text-text-secondary">
          Escolha uma senha com pelo menos {SENHA_MINIMA} caracteres.
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={aoSubmeter}>
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-text-secondary">Nova senha</span>
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
          <span className="text-label font-medium text-text-secondary">Confirmar nova senha</span>
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={SENHA_MINIMA}
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        </label>

        {erro && <p className="text-body-sm text-danger">{erro}</p>}

        <Button type="submit" disabled={enviando} className="w-full">
          {enviando ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </CartaoCentralizado>
  );
}
