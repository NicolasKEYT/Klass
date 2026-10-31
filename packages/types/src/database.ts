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
      avaliacoes_modelo: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          modulo_id: string
          ordem: number
          peso: number
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          modulo_id: string
          ordem: number
          peso: number
          titulo: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          modulo_id?: string
          ordem?: number
          peso?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_modelo_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos: {
        Row: {
          atualizado_em: string
          carga_horaria_horas: number
          criado_em: string
          descricao: string
          icone: string | null
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
          icone?: string | null
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
          icone?: string | null
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
          {
            foreignKeyName: "modulos_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "vw_desempenho_por_trilha"
            referencedColumns: ["trilha_id"]
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
          frequencia_minima_percentual: number
          icone: string | null
          id: string
          media_minima: number
          nome: string
          publicada: boolean
          slug: string
          tipo_certificacao: Database["catalogo"]["Enums"]["tipo_certificacao"]
        }
        Insert: {
          atualizado_em?: string
          carga_horaria_total?: number
          criado_em?: string
          descricao: string
          descricao_curta?: string | null
          frequencia_minima_percentual?: number
          icone?: string | null
          id?: string
          media_minima?: number
          nome: string
          publicada?: boolean
          slug: string
          tipo_certificacao?: Database["catalogo"]["Enums"]["tipo_certificacao"]
        }
        Update: {
          atualizado_em?: string
          carga_horaria_total?: number
          criado_em?: string
          descricao?: string
          descricao_curta?: string | null
          frequencia_minima_percentual?: number
          icone?: string | null
          id?: string
          media_minima?: number
          nome?: string
          publicada?: boolean
          slug?: string
          tipo_certificacao?: Database["catalogo"]["Enums"]["tipo_certificacao"]
        }
        Relationships: []
      }
    }
    Views: {
      vw_desempenho_por_trilha: {
        Row: {
          taxa_aprovacao_percentual: number | null
          total_aprovados: number | null
          total_encerrados: number | null
          trilha_id: string | null
          trilha_nome: string | null
        }
        Relationships: []
      }
      vw_taxa_evasao: {
        Row: {
          periodo: string | null
          taxa_evasao_percentual: number | null
          total_encerrados: number | null
          total_evadidos: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      avaliacoes_modelo_do_modulo: {
        Args: { p_modulo_id: string }
        Returns: {
          ordem: number
          peso: number
          titulo: string
        }[]
      }
      dependentes_em_outras_trilhas: {
        Args: { p_modulo_id?: string; p_trilha_id?: string }
        Returns: {
          modulo_dependente_id: string
          modulo_dependente_nome: string
          modulo_exigido_id: string
          modulo_exigido_nome: string
          trilha_dependente_id: string
          trilha_dependente_nome: string
        }[]
      }
      fonte_modulos: {
        Args: Record<PropertyKey, never>
        Returns: {
          modulo_id: string
          modulo_nome: string
          trilha_id: string
          trilha_nome: string
        }[]
      }
      frequencia_minima_padrao_do_modulo: {
        Args: { p_modulo_id: string }
        Returns: number
      }
      modulos_da_trilha: {
        Args: { p_trilha_id: string }
        Returns: {
          atualizado_em: string
          carga_horaria_horas: number
          criado_em: string
          descricao: string
          icone: string | null
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
          icone: string | null
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
      pre_requisitos_detalhados: {
        Args: { p_modulo_ids: string[] }
        Returns: {
          modulo_id: string
          nome: string
          pre_requisito_id: string
          trilha_id: string
          trilha_nome: string
          trilha_slug: string
        }[]
      }
      relatorio_trilhas: {
        Args: {
          p_fim?: string
          p_inicio?: string
          p_status?: string
          p_trilha_id?: string
        }
        Returns: {
          carga_horaria_modulo: number
          carga_horaria_trilha: number
          modulo_id: string
          modulo_nivel: string
          modulo_nome: string
          modulo_ordem: number
          pre_requisitos: string
          status_publicacao: string
          trilha_id: string
          trilha_nome: string
          turmas: number
        }[]
      }
      reordenar_avaliacoes_modelo: {
        Args: { p_ids: string[] }
        Returns: undefined
      }
      reordenar_modulos: { Args: { p_ids: string[] }; Returns: undefined }
      trocar_ordem_modulos: {
        Args: { p_modulo_a: string; p_modulo_b: string }
        Returns: undefined
      }
    }
    Enums: {
      nivel_modulo: "iniciante" | "intermediario" | "avancado"
      tipo_certificacao: "modulo" | "trilha" | "modulo_e_trilha"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  certificacao: {
    Tables: {
      certificados: {
        Row: {
          aluno_id: string
          aluno_nome: string
          emitido_em: string
          hash_publico: string
          id: string
          matricula_id: string | null
          metadata: NonNullable<Json>
          modulo_carga_horaria: number | null
          modulo_id: string | null
          modulo_nome: string | null
          motivo_revogacao: string | null
          nota_final: number | null
          periodo_fim: string | null
          periodo_inicio: string | null
          professor_nome: string | null
          revogado_em: string | null
          revogado_por: string | null
          trilha_carga_horaria_total: number | null
          trilha_id: string
          trilha_nome: string
          turma_codigo: string | null
        }
        Insert: {
          aluno_id: string
          aluno_nome: string
          emitido_em?: string
          hash_publico: string
          id?: string
          matricula_id?: string | null
          metadata?: NonNullable<Json>
          modulo_carga_horaria?: number | null
          modulo_id?: string | null
          modulo_nome?: string | null
          motivo_revogacao?: string | null
          nota_final?: number | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          professor_nome?: string | null
          revogado_em?: string | null
          revogado_por?: string | null
          trilha_carga_horaria_total?: number | null
          trilha_id: string
          trilha_nome: string
          turma_codigo?: string | null
        }
        Update: {
          aluno_id?: string
          aluno_nome?: string
          emitido_em?: string
          hash_publico?: string
          id?: string
          matricula_id?: string | null
          metadata?: NonNullable<Json>
          modulo_carga_horaria?: number | null
          modulo_id?: string | null
          modulo_nome?: string | null
          motivo_revogacao?: string | null
          nota_final?: number | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          professor_nome?: string | null
          revogado_em?: string | null
          revogado_por?: string | null
          trilha_carga_horaria_total?: number | null
          trilha_id?: string
          trilha_nome?: string
          turma_codigo?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      emitir_certificado_modulo: {
        Args: { p_matricula_id: string }
        Returns: string
      }
      fonte_certificados: {
        Args: Record<PropertyKey, never>
        Returns: {
          certificado_id: string
          emitido_em: string
          revogado_em: string
          trilha_id: string
        }[]
      }
      gerar_hash_publico: { Args: Record<PropertyKey, never>; Returns: string }
      relatorio_certificados: {
        Args: {
          p_fim?: string
          p_inicio?: string
          p_status?: string
          p_trilha_id?: string
        }
        Returns: {
          aluno_id: string
          aluno_nome: string
          certificado_id: string
          codigo_verificacao: string
          emitido_em: string
          modulo_nome: string
          revogado_em: string
          status: string
          tipo: string
          trilha_id: string
          trilha_nome: string
          turma_codigo: string
        }[]
      }
      revogar_certificados_da_matricula: {
        Args: { p_matricula_id: string; p_motivo: string }
        Returns: number
      }
      verificar_e_emitir: {
        Args: { p_aluno_id: string; p_trilha_id: string }
        Returns: string
      }
      verificar_por_hash: {
        Args: { p_hash: string }
        Returns: {
          aluno_nome: string
          emitido_em: string
          modulo_nome: string
          revogado: boolean
          revogado_em: string
          tipo: string
          trilha_nome: string
          turma_codigo: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  diario: {
    Tables: {
      aulas: {
        Row: {
          atualizada_em: string
          chamada_liberada_ate: string | null
          chamada_liberada_em: string | null
          chamada_liberada_por: string | null
          criada_em: string
          data: string
          descricao: string | null
          horario: string | null
          id: string
          sala: string | null
          turma_id: string
          chamada_aberta_ate: string | null
          situacao_chamada: string | null
        }
        Insert: {
          atualizada_em?: string
          chamada_liberada_ate?: string | null
          chamada_liberada_em?: string | null
          chamada_liberada_por?: string | null
          criada_em?: string
          data: string
          descricao?: string | null
          horario?: string | null
          id?: string
          sala?: string | null
          turma_id: string
        }
        Update: {
          atualizada_em?: string
          chamada_liberada_ate?: string | null
          chamada_liberada_em?: string | null
          chamada_liberada_por?: string | null
          criada_em?: string
          data?: string
          descricao?: string | null
          horario?: string | null
          id?: string
          sala?: string | null
          turma_id?: string
        }
        Relationships: []
      }
      avaliacoes: {
        Row: {
          atualizado_em: string
          criado_em: string
          descricao: string | null
          id: string
          ordem: number
          peso: number
          titulo: string
          turma_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          ordem: number
          peso: number
          titulo: string
          turma_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          ordem?: number
          peso?: number
          titulo?: string
          turma_id?: string
        }
        Relationships: []
      }
      historico_encerramentos: {
        Row: {
          acao: Database["diario"]["Enums"]["acao_encerramento"]
          certificados_revogados: number
          frequencia: number | null
          id: string
          matricula_id: string
          media: number | null
          motivo: string | null
          realizado_em: string
          realizado_por: string | null
          status_anterior: Database["selecao"]["Enums"]["status_matricula"]
          status_novo: Database["selecao"]["Enums"]["status_matricula"]
          turma_id: string
        }
        Insert: {
          acao: Database["diario"]["Enums"]["acao_encerramento"]
          certificados_revogados?: number
          frequencia?: number | null
          id?: string
          matricula_id: string
          media?: number | null
          motivo?: string | null
          realizado_em?: string
          realizado_por?: string | null
          status_anterior: Database["selecao"]["Enums"]["status_matricula"]
          status_novo: Database["selecao"]["Enums"]["status_matricula"]
          turma_id: string
        }
        Update: {
          acao?: Database["diario"]["Enums"]["acao_encerramento"]
          certificados_revogados?: number
          frequencia?: number | null
          id?: string
          matricula_id?: string
          media?: number | null
          motivo?: string | null
          realizado_em?: string
          realizado_por?: string | null
          status_anterior?: Database["selecao"]["Enums"]["status_matricula"]
          status_novo?: Database["selecao"]["Enums"]["status_matricula"]
          turma_id?: string
        }
        Relationships: []
      }
      materiais: {
        Row: {
          caminho: string
          enviado_em: string
          enviado_por: string
          id: string
          nome_arquivo: string
          tamanho_bytes: number
          tipo_mime: string
          titulo: string
          turma_id: string
        }
        Insert: {
          caminho: string
          enviado_em?: string
          enviado_por?: string
          id?: string
          nome_arquivo: string
          tamanho_bytes: number
          tipo_mime: string
          titulo: string
          turma_id: string
        }
        Update: {
          caminho?: string
          enviado_em?: string
          enviado_por?: string
          id?: string
          nome_arquivo?: string
          tamanho_bytes?: number
          tipo_mime?: string
          titulo?: string
          turma_id?: string
        }
        Relationships: []
      }
      notas: {
        Row: {
          avaliacao_id: string
          id: string
          lancada_em: string
          lancada_por: string
          matricula_id: string
          valor: number
        }
        Insert: {
          avaliacao_id: string
          id?: string
          lancada_em?: string
          lancada_por: string
          matricula_id: string
          valor: number
        }
        Update: {
          avaliacao_id?: string
          id?: string
          lancada_em?: string
          lancada_por?: string
          matricula_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      presencas: {
        Row: {
          aula_id: string
          id: string
          matricula_id: string
          presente: boolean
          registrada_em: string
          registrada_por: string
        }
        Insert: {
          aula_id: string
          id?: string
          matricula_id: string
          presente: boolean
          registrada_em?: string
          registrada_por: string
        }
        Update: {
          aula_id?: string
          id?: string
          matricula_id?: string
          presente?: boolean
          registrada_em?: string
          registrada_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "presencas_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aplicar_encerramento: {
        Args: { p_matricula_id: string }
        Returns: string
      }
      calcular_frequencia_percentual: {
        Args: { p_matricula_id: string }
        Returns: number
      }
      calcular_media_ponderada: {
        Args: { p_matricula_id: string }
        Returns: number
      }
      calcular_pronto_para_encerrar: {
        Args: { p_matricula_id: string }
        Returns: boolean
      }
      chamada_aberta_ate: {
        Args: { a: Database["diario"]["Tables"]["aulas"]["Row"] }
        Returns: string
      }
      chamada_pela_api: { Args: Record<PropertyKey, never>; Returns: boolean }
      chamadas_pendentes: {
        Args: Record<PropertyKey, never>
        Returns: {
          aberta_ate: string
          aula_id: string
          data: string
          situacao: string
          turma_id: string
        }[]
      }
      desfazer_encerramento: {
        Args: { p_matricula_id: string; p_motivo: string }
        Returns: Json
      }
      dias_prazo_chamada: { Args: Record<PropertyKey, never>; Returns: number }
      encerrar_matricula: {
        Args: { p_matricula_id: string }
        Returns: undefined
      }
      encerrar_turma: { Args: { p_turma_id: string }; Returns: Json }
      fonte_desempenho: {
        Args: Record<PropertyKey, never>
        Returns: {
          frequencia: number
          matricula_id: string
          media: number
        }[]
      }
      frequencia_percentual: {
        Args: { p_matricula_id: string }
        Returns: number
      }
      hoje: { Args: Record<PropertyKey, never>; Returns: string }
      indicadores_por_turma: {
        Args: Record<PropertyKey, never>
        Returns: {
          alunos_abaixo_minimo_legal: number
          alunos_com_frequencia: number
          frequencia_media: number
          total_aulas: number
          turma_id: string
        }[]
      }
      liberar_chamada: { Args: { p_aula_id: string }; Returns: string }
      media_ponderada: { Args: { p_matricula_id: string }; Returns: number }
      pode_gerenciar_turma: { Args: { p_turma_id: string }; Returns: boolean }
      pode_ler_materiais: { Args: { p_turma_id: string }; Returns: boolean }
      pode_ver_matricula: { Args: { p_matricula_id: string }; Returns: boolean }
      progresso_da_turma: {
        Args: { p_turma_id: string }
        Returns: {
          frequencia: number
          matricula_id: string
          media: number
          pronto_para_encerrar: boolean
        }[]
      }
      pronto_para_encerrar: {
        Args: { p_matricula_id: string }
        Returns: boolean
      }
      reabrir_matricula: {
        Args: {
          p_acao: Database["diario"]["Enums"]["acao_encerramento"]
          p_matricula_id: string
          p_motivo: string
        }
        Returns: Record<string, unknown>
      }
      reativar_turma: {
        Args: { p_motivo: string; p_turma_id: string }
        Returns: Json
      }
      relatorio_notas_frequencia: {
        Args: {
          p_fim?: string
          p_inicio?: string
          p_status?: string
          p_trilha_id?: string
        }
        Returns: {
          aluno_id: string
          aluno_nome: string
          frequencia_minima_percentual: number
          frequencia_percentual: number
          matricula_id: string
          modulo_nome: string
          nota_media: number
          status: string
          trilha_id: string
          trilha_nome: string
          turma_codigo: string
          turma_id: string
        }[]
      }
      situacao_chamada: {
        Args: { a: Database["diario"]["Tables"]["aulas"]["Row"] }
        Returns: string
      }
      situacao_chamada_em: {
        Args: { p_data: string; p_liberada_ate: string }
        Returns: string
      }
      tamanho_maximo_material: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      tipos_material_permitidos: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      turma_do_caminho: { Args: { p_nome: string }; Returns: string }
    }
    Enums: {
      acao_encerramento: "encerrar" | "desfazer" | "reativar_turma"
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
      data_local: { Args: { p_instante: string }; Returns: string }
      fonte_pessoas: {
        Args: {
          p_incluir_email: boolean
          p_papel: Database["identidade"]["Enums"]["papel"]
        }
        Returns: {
          criado_em: string
          email: string
          id: string
          nome_completo: string
        }[]
      }
      nomes_completos: {
        Args: { p_ids: string[] }
        Returns: {
          id: string
          nome_completo: string
        }[]
      }
      papel_do_usuario_atual: {
        Args: Record<PropertyKey, never>
        Returns: Database["identidade"]["Enums"]["papel"]
      }
      relatorio_alunos: {
        Args: {
          p_fim?: string
          p_inicio?: string
          p_status?: string
          p_trilha_id?: string
        }
        Returns: {
          aluno_id: string
          cadastrado_em: string
          email: string
          frequencia_media_matriculas: number
          matriculas_ativas: number
          nome: string
          nota_media: number
          trilhas_concluidas: number
        }[]
      }
      relatorio_docentes: {
        Args: {
          p_fim?: string
          p_inicio?: string
          p_status?: string
          p_trilha_id?: string
        }
        Returns: {
          alunos_ativos: number
          cadastrado_em: string
          docente_id: string
          nome: string
          turmas: number
          turmas_em_andamento: number
        }[]
      }
      usuario_e_coordenacao: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
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
          encerrada_em: string | null
          encerrada_por: string | null
          id: string
          motivo_conclusao: string | null
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
          encerrada_em?: string | null
          encerrada_por?: string | null
          id?: string
          motivo_conclusao?: string | null
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
          encerrada_em?: string | null
          encerrada_por?: string | null
          id?: string
          motivo_conclusao?: string | null
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
          turno: string | null
          vagas_total: number
        }
        Insert: {
          atualizado_em?: string
          codigo: string
          criado_em?: string
          frequencia_minima_percentual: number
          id?: string
          modulo_id: string
          periodo_fim: string
          periodo_inicio: string
          professor_id: string
          turno?: string | null
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
          turno?: string | null
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
      bloqueio_para_reabrir: {
        Args: { p_matricula_id: string }
        Returns: string
      }
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
      fonte_matriculas: {
        Args: Record<PropertyKey, never>
        Returns: {
          aluno_id: string
          criado_em: string
          deferido_em: string
          encerrada_em: string
          matricula_id: string
          status: string
          turma_id: string
        }[]
      }
      fonte_turmas: {
        Args: Record<PropertyKey, never>
        Returns: {
          codigo: string
          frequencia_minima_percentual: number
          modulo_id: string
          periodo_fim: string
          periodo_inicio: string
          professor_id: string
          turma_id: string
          turno: string
          vagas_total: number
        }[]
      }
      inscrever_aluno: { Args: { p_turma_id: string }; Returns: string }
      modulos_concluidos_do_aluno: {
        Args: { p_aluno_id: string }
        Returns: {
          encerrada_em: string
          matricula_id: string
          modulo_id: string
          periodo_fim: string
          periodo_inicio: string
          professor_id: string
          turma_codigo: string
          turma_id: string
        }[]
      }
      ocupacao_turmas: {
        Args: { p_turma_ids?: string[] }
        Returns: {
          concluidas: number
          inscricoes_encerradas: boolean
          inscritas: number
          matriculadas: number
          reprovadas: number
          turma_id: string
          vagas_restantes: number
          vagas_total: number
        }[]
      }
      professor_da_turma: { Args: { p_profile_id: string }; Returns: boolean }
      relatorio_indicadores: {
        Args: { p_fim?: string; p_inicio?: string; p_trilha_id?: string }
        Returns: Json
      }
      relatorio_matriculas: {
        Args: {
          p_fim?: string
          p_inicio?: string
          p_status?: string
          p_trilha_id?: string
        }
        Returns: {
          aluno_id: string
          aluno_nome: string
          deferido_em: string
          encerrada_em: string
          inscrito_em: string
          matricula_id: string
          modulo_nome: string
          status: string
          trilha_id: string
          trilha_nome: string
          turma_codigo: string
          turma_id: string
        }[]
      }
      relatorio_turmas: {
        Args: {
          p_fim?: string
          p_inicio?: string
          p_status?: string
          p_trilha_id?: string
        }
        Returns: {
          codigo: string
          concluidas: number
          docente_id: string
          docente_nome: string
          inscritas: number
          matriculadas: number
          modulo_nome: string
          ocupacao_acumulada_percentual: number
          ocupacao_percentual: number
          periodo_fim: string
          periodo_inicio: string
          reprovadas: number
          status: string
          trilha_id: string
          trilha_nome: string
          turma_id: string
          turno: string
          vagas_total: number
        }[]
      }
      remover_aluno_da_turma: {
        Args: { p_matricula_id: string; p_motivo: string }
        Returns: undefined
      }
      resumo_matricula: {
        Args: { p_matricula_id: string }
        Returns: {
          aluno_id: string
          encerrada_em: string
          modulo_id: string
          periodo_fim: string
          periodo_inicio: string
          professor_id: string
          status: Database["selecao"]["Enums"]["status_matricula"]
          turma_codigo: string
          turma_id: string
        }[]
      }
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
        | "reprovada"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      tipo_certificacao: ["modulo", "trilha", "modulo_e_trilha"],
    },
  },
  certificacao: {
    Enums: {},
  },
  diario: {
    Enums: {
      acao_encerramento: ["encerrar", "desfazer", "reativar_turma"],
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
        "reprovada",
      ],
    },
  },
} as const
