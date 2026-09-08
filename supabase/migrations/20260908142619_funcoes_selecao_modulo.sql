-- Ajuste das funções de validação para o novo modelo (turma = módulo).
-- validar_pre_requisitos_trilha e checar_matricula_ativa_na_trilha saem;
-- entram as equivalentes por módulo. A checagem de pré-requisito agora
-- chama catalogo.pre_requisitos_de_modulo() em vez de ler
-- selecao.pre_requisitos_trilha (que não existe mais) — também corrige
-- uma violação de fronteira que a versão anterior tinha: ler
-- catalogo.trilhas direto em vez de passar pela função do dono do dado.

drop function if exists selecao.validar_pre_requisitos_trilha(uuid, uuid);
drop function if exists selecao.checar_matricula_ativa_na_trilha(uuid, uuid);

create or replace function selecao.validar_pre_requisitos_modulo(p_aluno_id uuid, p_modulo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_faltantes text;
begin
  select string_agg(pr.nome, ', ')
  into v_faltantes
  from catalogo.pre_requisitos_de_modulo(p_modulo_id) pr
  where not exists (
    select 1
    from selecao.matriculas m
    join selecao.turmas t on t.id = m.turma_id
    where m.aluno_id = p_aluno_id
      and t.modulo_id = pr.id
      and m.status = 'concluida'
  );

  if v_faltantes is not null then
    raise exception 'Você precisa concluir o módulo % antes de se inscrever neste.', v_faltantes;
  end if;
end;
$$;

create or replace function selecao.checar_matricula_ativa_no_modulo(p_aluno_id uuid, p_modulo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from selecao.matriculas m
    join selecao.turmas t on t.id = m.turma_id
    where m.aluno_id = p_aluno_id
      and t.modulo_id = p_modulo_id
      and m.status in ('inscrita', 'matriculada')
  ) then
    raise exception 'Você já tem uma matrícula ativa neste módulo em outra turma.';
  end if;
end;
$$;

grant execute on function selecao.validar_pre_requisitos_modulo(uuid, uuid) to authenticated;
grant execute on function selecao.checar_matricula_ativa_no_modulo(uuid, uuid) to authenticated;

-- Só o corpo muda (trilha_id -> modulo_id); a ordem alfabética dos
-- triggers que garante "confirma que é aluno antes de checar regras de
-- negócio" continua valendo, não precisa recriar o trigger em si.
create or replace function selecao.validar_regras_negocio_matricula()
returns trigger
language plpgsql
as $$
declare
  v_modulo_id uuid;
begin
  select modulo_id into v_modulo_id from selecao.turmas where id = new.turma_id;

  perform selecao.checar_vaga_disponivel(new.turma_id);
  perform selecao.checar_matricula_ativa_no_modulo(new.aluno_id, v_modulo_id);
  perform selecao.validar_pre_requisitos_modulo(new.aluno_id, v_modulo_id);

  return new;
end;
$$;
