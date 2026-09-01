// MS1 — Identidade e Acesso (schema `identidade`)
// Perfis de usuário, RBAC e autorização.

import type { Database } from "./database";

export type Papel = Database["identidade"]["Enums"]["papel"];
export type Profile = Database["identidade"]["Tables"]["profiles"]["Row"];
