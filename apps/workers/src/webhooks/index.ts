// Recebedores de Database Webhooks disparados por triggers do Postgres
// (coreografia orientada a eventos — ver CLAUDE.md). Cada evento de
// domínio que precisa sair do banco (e-mail, por exemplo) ganha um
// receptor aqui, registrado nas rotas de `src/index.ts`.

export { receberMatriculaDeferida } from "./matriculaDeferida";
export { receberCertificadoEmitido } from "./certificadoEmitido";
