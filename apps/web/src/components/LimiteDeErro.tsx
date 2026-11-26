import { Component, type ErrorInfo, type ReactNode } from "react";
import { AvisoDePagina } from "@/components/AvisoDePagina";
import { Button } from "@/components/Button";

interface LimiteDeErroProps {
  children: ReactNode;
  /** Ver AvisoDePagina: fora da casca do layout, ocupa a tela inteira. */
  telaCheia?: boolean;
}

interface LimiteDeErroState {
  erro: boolean;
}

// Sem isto, um erro de renderização desmonta a árvore inteira e deixa a
// tela branca. Precisa ser classe: o React só oferece captura de erro de
// renderização por getDerivedStateFromError/componentDidCatch. Para
// voltar ao normal ao trocar de rota, quem usa passa `key` com o caminho.
export class LimiteDeErro extends Component<LimiteDeErroProps, LimiteDeErroState> {
  state: LimiteDeErroState = { erro: false };

  static getDerivedStateFromError(): LimiteDeErroState {
    return { erro: true };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error("Erro de renderização", erro, info.componentStack);
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <AvisoDePagina
        telaCheia={this.props.telaCheia}
        titulo="Algo deu errado"
        texto="Tente recarregar a página. Se o problema continuar, avise a coordenação."
        acao={<Button onClick={() => window.location.reload()}>Recarregar</Button>}
      />
    );
  }
}
