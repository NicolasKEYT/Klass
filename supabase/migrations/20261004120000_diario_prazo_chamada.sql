-- MS4 — prazo da chamada (decisão do dono do produto em 03/10/2026; pedido
-- antigo: "bloqueio na parte de chamadas para não poder modificar toda hora
-- qualquer chamada"):
--   * aula futura: ninguém faz chamada;
--   * o professor faz ou altera a chamada até 7 dias depois da data da aula;
--   * depois disso, só com liberação da coordenação (mais 7 dias, com
--     registro de quem liberou e até quando);
--   * a coordenação sempre pode alterar uma aula passada.
-- É invariante do dado: vale para qualquer caminho de escrita (tela, API
-- direta, exclusão em cascata ao apagar a aula), por isso mora em trigger.

-- "Hoje" no fuso da instituição. Fixo em São Paulo por enquanto; virá da
-- configuração institucional quando ela existir. Comparar com current_date
-- (UTC no servidor) faria a chamada fechar às 21h do sétimo dia.
create or replace function diario.hoje()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

grant execute on function diario.hoje() to authenticated, service_role;
revoke execute on function diario.hoje() from public, anon;

-- Dias que o professor tem para fazer/alterar a chamada, contados da data
-- da aula (inclusive o 7º dia). Função, não literal espalhado: a mesma
-- regra serve o trigger, a tela e a liberação.
create or replace function diario.dias_prazo_chamada()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 7;
$$;

grant execute on function diario.dias_prazo_chamada() to authenticated, service_role;
revoke execute on function diario.dias_prazo_chamada() from public, anon;

alter table diario.aulas
  add column if not exists chamada_liberada_ate date null,
  add column if not exists chamada_liberada_por uuid null references identidade.profiles (id) on delete restrict,
  add column if not exists chamada_liberada_em timestamptz null;

comment on column diario.aulas.chamada_liberada_ate is
  'Liberação da coordenação: até esta data (inclusive) o professor pode refazer a chamada mesmo fora do prazo de 7 dias.';

-- Situação da chamada de uma aula, para o trigger e para a tela:
--   futura    — a aula ainda não aconteceu (ninguém faz chamada);
--   aberta    — dentro dos 7 dias;
--   liberada  — fora dos 7 dias, mas liberada pela coordenação;
--   encerrada — fora do prazo e sem liberação vigente.
create or replace function diario.situacao_chamada_em(p_data date, p_liberada_ate date)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_data > diario.hoje() then 'futura'
    when diario.hoje() <= p_data + diario.dias_prazo_chamada() then 'aberta'
    when p_liberada_ate is not null and diario.hoje() <= p_liberada_ate then 'liberada'
    else 'encerrada'
  end;
$$;

grant execute on function diario.situacao_chamada_em(date, date) to authenticated, service_role;
revoke execute on function diario.situacao_chamada_em(date, date) from public, anon;

-- Campos calculados do PostgREST (select=*,situacao_chamada,chamada_aberta_ate):
-- a tela lê a situação já decidida pelo banco, sem repetir a regra nem o
-- fuso no navegador.
create or replace function diario.situacao_chamada(a diario.aulas)
returns text
language sql
stable
set search_path = ''
as $$
  select diario.situacao_chamada_em(a.data, a.chamada_liberada_ate);
$$;

-- Último dia em que o professor ainda pode mexer na chamada (prazo normal
-- ou liberação, o que for maior).
create or replace function diario.chamada_aberta_ate(a diario.aulas)
returns date
language sql
stable
set search_path = ''
as $$
  select greatest(a.data + diario.dias_prazo_chamada(), a.chamada_liberada_ate);
$$;

grant execute on function diario.situacao_chamada(diario.aulas) to authenticated, service_role;
grant execute on function diario.chamada_aberta_ate(diario.aulas) to authenticated, service_role;
revoke execute on function diario.situacao_chamada(diario.aulas) from public, anon;
revoke execute on function diario.chamada_aberta_ate(diario.aulas) from public, anon;

-- ---------------------------------------------------------------------------
-- Invariante em diario.presencas (inclusive exclusão).
-- Só vale para quem fala pela API (role authenticated/anon — ver
-- diario.chamada_pela_api): seed rodando como postgres e service role não
-- têm usuário a restringir. A exclusão em cascata ao apagar a aula também
-- passa por aqui (o trigger de aulas abaixo já barra antes; aula não
-- encontrada = cascata em andamento, já validada lá).
create or replace function diario.validar_prazo_chamada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aula_id uuid := coalesce(new.aula_id, old.aula_id);
  v_data date;
  v_liberada_ate date;
  v_situacao text;
begin
  if not diario.chamada_pela_api() then
    return coalesce(new, old);
  end if;

  select data, chamada_liberada_ate into v_data, v_liberada_ate
  from diario.aulas where id = v_aula_id;
  if v_data is null then
    return coalesce(new, old);
  end if;

  v_situacao := diario.situacao_chamada_em(v_data, v_liberada_ate);

  -- Aula futura: ninguém faz chamada. Excluir presença de aula futura
  -- (dado antigo, ou aula apagada) continua permitido.
  if v_situacao = 'futura' and tg_op <> 'DELETE' then
    raise exception 'Não é possível fazer a chamada de uma aula futura.';
  end if;

  if v_situacao = 'encerrada' and not identidade.usuario_e_coordenacao() then
    raise exception
      'O prazo para fazer ou alterar a chamada desta aula terminou em % (% dias após a aula). A coordenação pode liberar a chamada por mais % dias.',
      to_char(v_data + diario.dias_prazo_chamada(), 'DD/MM/YYYY'),
      diario.dias_prazo_chamada(), diario.dias_prazo_chamada();
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists presencas_valida_prazo_chamada on diario.presencas;
create trigger presencas_valida_prazo_chamada
  before insert or update or delete on diario.presencas
  for each row
  execute function diario.validar_prazo_chamada();

-- ---------------------------------------------------------------------------
-- Guarda em diario.aulas: a RLS deixa o professor da turma editar e apagar a
-- aula; sem isto ele contornaria o prazo (apagando uma aula com chamada
-- fechada, mudando a data de uma aula antiga para hoje ou se dando a
-- própria liberação).
create or replace function diario.validar_alteracao_aula()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_situacao text;
begin
  if not diario.chamada_pela_api() or identidade.usuario_e_coordenacao() then
    return coalesce(new, old);
  end if;

  v_situacao := diario.situacao_chamada_em(old.data, old.chamada_liberada_ate);

  if tg_op = 'DELETE' then
    if v_situacao = 'encerrada'
       and exists (select 1 from diario.presencas p where p.aula_id = old.id) then
      raise exception
        'Esta aula tem chamada e o prazo para alterá-la terminou; para apagá-la, peça à coordenação para liberar a chamada.';
    end if;
    return old;
  end if;

  if new.chamada_liberada_ate is distinct from old.chamada_liberada_ate
     or new.chamada_liberada_por is distinct from old.chamada_liberada_por
     or new.chamada_liberada_em is distinct from old.chamada_liberada_em then
    raise exception 'Só a coordenação pode liberar a chamada de uma aula.';
  end if;

  if new.data is distinct from old.data and v_situacao = 'encerrada' then
    raise exception
      'A chamada desta aula já está fora do prazo; para mudar a data, peça à coordenação para liberar a chamada.';
  end if;

  return new;
end;
$$;

drop trigger if exists aulas_valida_alteracao on diario.aulas;
create trigger aulas_valida_alteracao
  before update or delete on diario.aulas
  for each row
  execute function diario.validar_alteracao_aula();

-- ---------------------------------------------------------------------------
-- "Liberar chamada" (coordenação): o professor ganha mais 7 dias a partir
-- de hoje para fazer ou refazer a chamada. Fica registrado quem liberou e
-- até quando. Devolve a nova data limite.
create or replace function diario.liberar_chamada(p_aula_id uuid)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data date;
  v_ate date;
begin
  if not identidade.usuario_e_coordenacao() then
    raise exception 'apenas a coordenação pode liberar a chamada';
  end if;

  select data into v_data from diario.aulas where id = p_aula_id;
  if v_data is null then
    raise exception 'aula não encontrada';
  end if;
  if v_data > diario.hoje() then
    raise exception 'Não é possível liberar a chamada de uma aula futura.';
  end if;

  v_ate := diario.hoje() + diario.dias_prazo_chamada();

  update diario.aulas
  set chamada_liberada_ate = v_ate,
      chamada_liberada_por = auth.uid(),
      chamada_liberada_em = now()
  where id = p_aula_id;

  return v_ate;
end;
$$;

revoke execute on function diario.liberar_chamada(uuid) from public, anon;
grant execute on function diario.liberar_chamada(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Chamadas pendentes: aulas que já passaram e não têm nenhuma presença
-- registrada, com a situação do prazo. Coordenação recebe todas; professor,
-- as das próprias turmas. Substitui a leitura de TODAS as presenças das
-- aulas passadas no navegador (que truncava em 1000 linhas).
create or replace function diario.chamadas_pendentes()
returns table (aula_id uuid, turma_id uuid, data date, situacao text, aberta_ate date)
language sql
security definer
stable
set search_path = ''
as $$
  select au.id, au.turma_id, au.data,
         diario.situacao_chamada_em(au.data, au.chamada_liberada_ate),
         greatest(au.data + diario.dias_prazo_chamada(), au.chamada_liberada_ate)
  from diario.aulas au
  join selecao.turmas t on t.id = au.turma_id
  where au.data < diario.hoje()
    and not exists (select 1 from diario.presencas p where p.aula_id = au.id)
    and (identidade.usuario_e_coordenacao() or t.professor_id = auth.uid())
  order by au.data, au.horario nulls first;
$$;

revoke execute on function diario.chamadas_pendentes() from public, anon;
grant execute on function diario.chamadas_pendentes() to authenticated, service_role;
