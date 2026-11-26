// Tamanho mínimo da senha. É o mesmo do cadastro e o do banco local
// (`minimum_password_length` no supabase/config.toml); no projeto hospedado
// o valor vive no painel do Supabase (Authentication). Se mudar um, mude os
// dois: o front só avisa antes, quem recusa de verdade é o Supabase Auth.
export const SENHA_MINIMA = 6;
