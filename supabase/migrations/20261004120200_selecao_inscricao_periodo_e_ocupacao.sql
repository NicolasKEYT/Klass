-- MS3 — duas correções do motor de seleção:
--   * inscrição fecha quando o período da turma termina (resposta à
--     verificação "as datas da turma têm efeito?"). Não encerra alunos
--     automaticamente: isso continua manual, pelo diário;
--   * ocupação real das turmas. O aluno via vagas superestimadas porque a
--     RLS só deixa ele contar as próprias matrículas; e as listas da
--     coordenação/professor traziam todas as matrículas para contar no
--     navegador (truncando em 1000 linhas).

-- Mesmas regras de antes (vaga, matrícula ativa no módulo, pré-requisito),
-- mais o período. Recriada a partir de 20260908142619.
create or replace function selecao.validar_regras_negocio_matricula()
returns trigger
language plpgsql
as $$
declare
  v_modulo_id uuid;
  v_periodo_fim date;
begin
  select modulo_id, periodo_fim into v_modulo_id, v_periodo_fim
  from selecao.turmas where id = new.turma_id;

  -- Só para quem se inscreve pela API (o aluno): o seed e o service role
  -- montam histórico em turmas passadas. "Hoje" no fuso da instituição
  -- (São Paulo; virá da configuração institucional no futuro), como no
  -- prazo da chamada do diário.
  if coalesce(current_setting('role', true), 'none') in ('authenticated', 'anon')
     and v_periodo_fim < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'As inscrições desta turma estão encerradas: o período terminou em %.',
      to_char(v_periodo_fim, 'DD/MM/YYYY');
  end if;

  perform selecao.checar_vaga_disponivel(new.turma_id);
  perform selecao.checar_matricula_ativa_no_modulo(new.aluno_id, v_modulo_id);
  perform selecao.validar_pre_requisitos_modulo(new.aluno_id, v_modulo_id);

  return new;
end;
$$;

-- Ocupação de uma lista de turmas (null = todas): contagem por situação,
-- vagas e vagas restantes (inscrita + matriculada ocupam vaga, mesma conta
-- de checar_vaga_disponivel) e se as inscrições já fecharam pelo período
-- (mesma regra e mesmo fuso da validação acima). Só números agregados —
-- nenhum dado de aluno —, por isso aberta a qualquer usuário logado: é o
-- que o aluno precisa para ver as vagas reais no detalhe do módulo.
create or replace function selecao.ocupacao_turmas(p_turma_ids uuid[] default null)
returns table (
  turma_id uuid,
  vagas_total smallint,
  inscritas integer,
  matriculadas integer,
  concluidas integer,
  reprovadas integer,
  vagas_restantes integer,
  inscricoes_encerradas boolean
)
language sql
security definer
stable
set search_path = ''
as $$
  select t.id,
         t.vagas_total,
         count(m.id) filter (where m.status = 'inscrita')::integer,
         count(m.id) filter (where m.status = 'matriculada')::integer,
         count(m.id) filter (where m.status = 'concluida')::integer,
         count(m.id) filter (where m.status = 'reprovada')::integer,
         (t.vagas_total - count(m.id) filter (where m.status in ('inscrita', 'matriculada')))::integer,
         t.periodo_fim < (now() at time zone 'America/Sao_Paulo')::date
  from selecao.turmas t
  left join selecao.matriculas m on m.turma_id = t.id
  where p_turma_ids is null or t.id = any(p_turma_ids)
  group by t.id, t.vagas_total, t.periodo_fim;
$$;

revoke execute on function selecao.ocupacao_turmas(uuid[]) from public, anon;
grant execute on function selecao.ocupacao_turmas(uuid[]) to authenticated, service_role;
