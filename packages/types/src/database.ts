// ARQUIVO GERADO — não edite à mão.
// Gerado via `supabase gen types typescript --linked > packages/types/src/database.ts`.
// Qualquer mudança de schema entra por migration em supabase/migrations/,
// depois roda o comando de novo para regenerar este arquivo.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  catalogo: {
    Tables: {
      modulos: {
        Row: {
          atualizado_em: string
          carga_horaria_horas: number
          criado_em: string
          descricao: string
          id: string
          nivel: Database["catalogo"]["Enums"]["nivel_modulo"]
          nome: string
          ordem: number
          trilha_id: string
        }
        Insert: {
          atualizado_em?: string
          carga_horaria_horas: number
          criado_em?: string
          descricao: string
          id?: string
          nivel: Database["catalogo"]["Enums"]["nivel_modulo"]
          nome: string
          ordem: number
          trilha_id: string
        }
        Update: {
          atualizado_em?: string
          carga_horaria_horas?: number
          criado_em?: string
          descricao?: string
          id?: string
          nivel?: Database["catalogo"]["Enums"]["nivel_modulo"]
          nome?: string
          ordem?: number
          trilha_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modulos_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_requisitos_modulo: {
        Row: {
          modulo_id: string
          pre_requisito_id: string
        }
        Insert: {
          modulo_id: string
          pre_requisito_id: string
        }
        Update: {
          modulo_id?: string
          pre_requisito_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_requisitos_modulo_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_requisitos_modulo_pre_requisito_id_fkey"
            columns: ["pre_requisito_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      trilhas: {
        Row: {
          atualizado_em: string
          carga_horaria_total: number
          criado_em: string
          descricao: string
          descricao_curta: string | null
          id: string
          nome: string
          publicada: boolean
          slug: string
        }
        Insert: {
          atualizado_em?: string
          carga_horaria_total?: number
          criado_em?: string
          descricao: string
          descricao_curta?: string | null
          id?: string
          nome: string
          publicada?: boolean
          slug: string
        }
        Update: {
          atualizado_em?: string
          carga_horaria_total?: number
          criado_em?: string
          descricao?: string
          descricao_curta?: string | null
          id?: string
          nome?: string
          publicada?: boolean
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      modulos_da_trilha: {
        Args: { p_trilha_id: string }
        Returns: {
          atualizado_em: string
          carga_horaria_horas: number
          criado_em: string
          descricao: string
          id: string
          nivel: Database["catalogo"]["Enums"]["nivel_modulo"]
          nome: string
          ordem: number
          trilha_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "modulos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      pre_requisitos_de_modulo: {
        Args: { p_modulo_id: string }
        Returns: {
          atualizado_em: string
          carga_horaria_horas: number
          criado_em: string
          descricao: string
          id: string
          nivel: Database["catalogo"]["Enums"]["nivel_modulo"]
          nome: string
          ordem: number
          trilha_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "modulos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      trocar_ordem_modulos: {
        Args: { p_modulo_a: string; p_modulo_b: string }
        Returns: undefined
      }
    }
    Enums: {
      nivel_modulo: "iniciante" | "intermediario" | "avancado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  identidade: {
    Tables: {
      profiles: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          nome_completo: string
          papel: Database["identidade"]["Enums"]["papel"]
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id: string
          nome_completo: string
          papel?: Database["identidade"]["Enums"]["papel"]
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome_completo?: string
          papel?: Database["identidade"]["Enums"]["papel"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      nomes_completos: {
        Args: { p_ids: string[] }
        Returns: {
          id: string
          nome_completo: string
        }[]
      }
      papel_do_usuario_atual: {
        Args: never
        Returns: Database["identidade"]["Enums"]["papel"]
      }
      usuario_e_coordenacao: { Args: never; Returns: boolean }
    }
    Enums: {
      papel: "aluno" | "professor" | "coordenacao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  selecao: {
    Tables: {
      matriculas: {
        Row: {
          aluno_id: string
          atualizado_em: string
          criado_em: string
          deferido_em: string | null
          deferido_por: string | null
          id: string
          motivo_rejeicao: string | null
          status: Database["selecao"]["Enums"]["status_matricula"]
          turma_id: string
        }
        Insert: {
          aluno_id: string
          atualizado_em?: string
          criado_em?: string
          deferido_em?: string | null
          deferido_por?: string | null
          id?: string
          motivo_rejeicao?: string | null
          status?: Database["selecao"]["Enums"]["status_matricula"]
          turma_id: string
        }
        Update: {
          aluno_id?: string
          atualizado_em?: string
          criado_em?: string
          deferido_em?: string | null
          deferido_por?: string | null
          id?: string
          motivo_rejeicao?: string | null
          status?: Database["selecao"]["Enums"]["status_matricula"]
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          atualizado_em: string
          codigo: string
          criado_em: string
          frequencia_minima_percentual: number
          id: string
          modulo_id: string
          periodo_fim: string
          periodo_inicio: string
          professor_id: string
          vagas_total: number
        }
        Insert: {
          atualizado_em?: string
          codigo: string
          criado_em?: string
          frequencia_minima_percentual?: number
          id?: string
          modulo_id: string
          periodo_fim: string
          periodo_inicio: string
          professor_id: string
          vagas_total: number
        }
        Update: {
          atualizado_em?: string
          codigo?: string
          criado_em?: string
          frequencia_minima_percentual?: number
          id?: string
          modulo_id?: string
          periodo_fim?: string
          periodo_inicio?: string
          professor_id?: string
          vagas_total?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aluno_da_matricula: { Args: { p_profile_id: string }; Returns: boolean }
      cancelar_inscricao: {
        Args: { p_matricula_id: string }
        Returns: undefined
      }
      checar_matricula_ativa_no_modulo: {
        Args: { p_aluno_id: string; p_modulo_id: string }
        Returns: undefined
      }
      checar_vaga_disponivel: {
        Args: { p_turma_id: string }
        Returns: undefined
      }
      inscrever_aluno: { Args: { p_turma_id: string }; Returns: string }
      professor_da_turma: { Args: { p_profile_id: string }; Returns: boolean }
      validar_pre_requisitos_modulo: {
        Args: { p_aluno_id: string; p_modulo_id: string }
        Returns: undefined
      }
    }
    Enums: {
      status_matricula:
        | "inscrita"
        | "matriculada"
        | "rejeitada"
        | "cancelada"
        | "concluida"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  catalogo: {
    Enums: {
      nivel_modulo: ["iniciante", "intermediario", "avancado"],
    },
  },
  graphql_public: {
    Enums: {},
  },
  identidade: {
    Enums: {
      papel: ["aluno", "professor", "coordenacao"],
    },
  },
  public: {
    Enums: {},
  },
  selecao: {
    Enums: {
      status_matricula: [
        "inscrita",
        "matriculada",
        "rejeitada",
        "cancelada",
        "concluida",
      ],
    },
  },
} as const
