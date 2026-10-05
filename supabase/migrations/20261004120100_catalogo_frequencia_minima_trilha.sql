-- MS2/MS3 — frequência mínima padrão na trilha (item C9; decisão do dono do
-- produto em 03/10/2026): a trilha define o padrão, toda turma nova já
-- nasce com ele e cada turma ainda pode ajustar, como hoje. Turmas
-- existentes não mudam.

-- Default 75 (mínimo da LDB, art. 24, e o valor que as turmas já usavam):
-- trilhas existentes passam a ter o mesmo padrão que estava embutido nas
-- turmas.
alter table catalogo.trilhas
  add column if not exists frequencia_minima_percentual smallint not null default 75;

alter table catalogo.trilhas
  add constraint trilhas_frequencia_minima_faixa check (frequencia_minima_percentual between 0 and 100);

comment on column catalogo.trilhas.frequencia_minima_percentual is
  'Frequência mínima (%) padrão para as turmas novas dos módulos desta trilha; cada turma pode ajustar a sua.';

-- MS2 é o dono da trilha: o MS3 pergunta o padrão por esta função em vez
-- de ler catalogo.trilhas direto.
create or replace function catalogo.frequencia_minima_padrao_do_modulo(p_modulo_id uuid)
returns smallint
language sql
security definer
stable
set search_path = ''
as $$
  select tr.frequencia_minima_percentual
  from catalogo.modulos mo
  join catalogo.trilhas tr on tr.id = mo.trilha_id
  where mo.id = p_modulo_id;
$$;

revoke execute on function catalogo.frequencia_minima_padrao_do_modulo(uuid) from public, anon;
grant execute on function catalogo.frequencia_minima_padrao_do_modulo(uuid) to authenticated, service_role;

-- Turma nova sem frequência informada herda a da trilha. O default fixo
-- (75) sai da coluna: com ele, o trigger não saberia distinguir "não
-- informado" de "informado 75". O NOT NULL continua valendo — é checado
-- depois dos triggers BEFORE.
alter table selecao.turmas alter column frequencia_minima_percentual drop default;

create or replace function selecao.herdar_frequencia_minima_da_trilha()
returns trigger
language plpgsql
as $$
begin
  if new.frequencia_minima_percentual is null then
    new.frequencia_minima_percentual := coalesce(
      catalogo.frequencia_minima_padrao_do_modulo(new.modulo_id), 75
    );
  end if;
  return new;
end;
$$;

drop trigger if exists turmas_herda_frequencia_minima on selecao.turmas;
create trigger turmas_herda_frequencia_minima
  before insert on selecao.turmas
  for each row
  execute function selecao.herdar_frequencia_minima_da_trilha();
