import { useAuth } from "@/auth";
import { AvisoDePagina } from "@/components/AvisoDePagina";
import { LayoutAutenticado } from "@/components/LayoutAutenticado";
import { LinkBotao } from "@/components/LinkBotao";

// Rota "*". Logado, a página aparece dentro da casca (o usuário continua
// com o menu à mão); sem login, aparece sozinha. Não redireciona para
// /entrar: um link quebrado não é pedido de login.
export function RotaNaoEncontrada() {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body-sm text-text-secondary">
        Carregando...
      </div>
    );
  }

  return usuario ? (
    <LayoutAutenticado>
      <NaoEncontrada />
    </LayoutAutenticado>
  ) : (
    <NaoEncontrada />
  );
}

export function NaoEncontrada() {
  const { usuario } = useAuth();
  return (
    <AvisoDePagina
      telaCheia={!usuario}
      titulo="Página não encontrada"
      texto="O endereço que você abriu não existe ou foi movido."
      acao={<LinkBotao to="/">Voltar ao início</LinkBotao>}
    />
  );
}
