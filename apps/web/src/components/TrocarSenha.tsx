import { useState, type FormEvent } from "react";
import { useAuth } from "@/auth";
import { SENHA_MINIMA } from "@/auth/senha";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

// Troca de senha de quem já está logado, no Perfil. Pede a senha atual de
// propósito: quem encontrar o computador com a conta aberta não deveria
// conseguir trancar o dono para fora. Quem esqueceu a senha usa "Esqueci minha
// senha" na tela de entrada.
export function TrocarSenha() {
  const { trocarSenha } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [trocada, setTrocada] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setTrocada(false);

    if (novaSenha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }

    setEnviando(true);
    try {
      await trocarSenha(senhaAtual, novaSenha);
      setTrocada(true);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmacao("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível trocar a senha.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={aoSubmeter}>
      <label className="flex flex-col gap-1.5">
        <span className="text-label font-medium text-text-secondary">Senha atual</span>
        <Input
          type="password"
          autoComplete="current-password"
          required
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-text-secondary">Nova senha</span>
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={SENHA_MINIMA}
            aria-describedby="dica-nova-senha"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
          />
        </label>
        {/* Fora do <label>: dentro dele a dica viraria parte do nome do campo. */}
        <span id="dica-nova-senha" className="text-label text-text-muted">
          Pelo menos {SENHA_MINIMA} caracteres.
        </span>
      </div>

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

      {erro && (
        <Aviso variant="danger" role="alert">
          {erro}
        </Aviso>
      )}
      {trocada && <Aviso variant="success">Senha alterada.</Aviso>}

      <Button type="submit" disabled={enviando} className="w-full sm:w-fit">
        {enviando ? "Salvando..." : "Trocar senha"}
      </Button>
    </form>
  );
}
