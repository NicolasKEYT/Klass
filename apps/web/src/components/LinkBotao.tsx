import type { LinkProps } from "react-router-dom";
import { classesDoBotao, type ButtonVariant } from "@/components/Button";
import { LinkComPrefetch } from "@/components/LinkComPrefetch";

// Link com aparência de botão. Substitui <Link><Button/></Link>, que é
// HTML inválido (elemento interativo dentro de outro) e criava duas
// paradas de Tab para a mesma ação.
export function LinkBotao({
  variant = "primary",
  className = "",
  ...props
}: LinkProps & { variant?: ButtonVariant }) {
  return <LinkComPrefetch {...props} className={classesDoBotao(variant, className)} />;
}
