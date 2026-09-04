-- API do MS3 exposta ao frontend via .rpc(). SECURITY INVOKER (padrão) em
-- ambas — a garantia de "só o próprio aluno" não vem de um papel
-- elevado, vem de auth.uid() e da RLS de quem chama.

-- Nunca aceita aluno_id como argumento — só auth.uid() — para impedir
-- "inscrever outro aluno" através da API.
create or replace function selecao.inscrever_aluno(p_turma_id uuid)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
begin
  insert into selecao.matriculas (aluno_id, turma_id)
  values (auth.uid(), p_turma_id)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function selecao.inscrever_aluno(uuid) to authenticated;

create or replace function selecao.cancelar_inscricao(p_matricula_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_aluno_id uuid;
  v_status selecao.status_matricula;
begin
  select aluno_id, status into v_aluno_id, v_status
  from selecao.matriculas
  where id = p_matricula_id;

  -- Sob RLS, um aluno não vê a linha de outro aluno — isso já cai aqui
  -- como "não encontrada" antes mesmo de comparar o dono.
  if v_aluno_id is null then
    raise exception 'matrícula não encontrada';
  end if;

  if v_aluno_id <> auth.uid() then
    raise exception 'você só pode cancelar a própria inscrição';
  end if;

  if v_status <> 'inscrita' then
    raise exception 'só é possível cancelar uma inscrição pendente — fale com a coordenação';
  end if;

  update selecao.matriculas set status = 'cancelada' where id = p_matricula_id;
end;
$$;

grant execute on function selecao.cancelar_inscricao(uuid) to authenticated;
