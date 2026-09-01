-- API interno do MS2: outros módulos (MS3 principalmente) que precisarem
-- de módulos de uma trilha ou dos pré-requisitos de um módulo devem
-- chamar estas funções, não ler catalogo.modulos/pre_requisitos_modulo
-- direto — mesma regra de fronteira entre bounded contexts do CLAUDE.md.
-- SECURITY INVOKER (padrão do Postgres, explícito aqui por clareza):
-- respeita a RLS de quem chama, então um aluno continua sem ver módulos
-- de trilha não publicada mesmo passando pela função.

create or replace function catalogo.modulos_da_trilha(p_trilha_id uuid)
returns setof catalogo.modulos
language sql
security invoker
stable
as $$
  select *
  from catalogo.modulos
  where trilha_id = p_trilha_id
  order by ordem;
$$;

create or replace function catalogo.pre_requisitos_de_modulo(p_modulo_id uuid)
returns setof catalogo.modulos
language sql
security invoker
stable
as $$
  select m.*
  from catalogo.pre_requisitos_modulo pr
  join catalogo.modulos m on m.id = pr.pre_requisito_id
  where pr.modulo_id = p_modulo_id
  order by m.ordem;
$$;

grant execute on function catalogo.modulos_da_trilha(uuid) to authenticated;
grant execute on function catalogo.pre_requisitos_de_modulo(uuid) to authenticated;
