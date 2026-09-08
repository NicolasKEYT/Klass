-- MS4 — Diário de Classe: avaliações, notas, aulas e presenças por
-- turma (turma = um módulo, ver MS3). O professor lança tudo aqui; o
-- sistema calcula aprovação/reprovação sozinho quando ele encerra.
create schema if not exists diario;
comment on schema diario is 'MS4 — Diário de Classe: avaliações, notas, aulas e presenças.';

-- Alteração de MS3 motivada por MS4: aluno pode reprovar por média ou
-- frequência, não só ser aprovado. `alter type ... add value` não roda
-- dentro de bloco transacional com outros comandos que usem o tipo na
-- mesma transação — por isso fica em statement isolado, fora de um `do $$`.
alter type selecao.status_matricula add value if not exists 'reprovada';

-- Auditoria de encerramento mora em selecao (é a matrícula que fecha),
-- mesmo o cálculo sendo feito por funções do diario.
alter table selecao.matriculas
  add column if not exists motivo_conclusao text,
  add column if not exists encerrada_em timestamptz,
  add column if not exists encerrada_por uuid references identidade.profiles (id);

create table if not exists diario.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references selecao.turmas (id) on delete cascade,
  titulo text not null,
  descricao text,
  -- Peso é inteiro positivo livre (não precisa somar 100) — a média
  -- ponderada normaliza pelo total dos pesos das avaliações COM nota.
  peso smallint not null,
  ordem smallint not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint avaliacoes_titulo_minimo check (char_length(btrim(titulo)) >= 2),
  constraint avaliacoes_peso_positivo check (peso > 0),
  -- Sem isso, duas avaliações da mesma turma disputariam a mesma posição.
  constraint avaliacoes_turma_ordem_unica unique (turma_id, ordem)
);
comment on table diario.avaliacoes is 'Avaliações de uma turma (Prova 1, Trabalho, ...), definidas pelo professor.';

create index if not exists avaliacoes_turma_ordem_idx on diario.avaliacoes (turma_id, ordem);

create table if not exists diario.notas (
  id uuid primary key default gen_random_uuid(),
  avaliacao_id uuid not null references diario.avaliacoes (id) on delete cascade,
  matricula_id uuid not null references selecao.matriculas (id) on delete cascade,
  valor numeric(4, 2) not null,
  lancada_em timestamptz not null default now(),
  lancada_por uuid not null references identidade.profiles (id),
  constraint notas_valor_na_faixa check (valor between 0 and 10),
  -- Uma nota por aluno por avaliação — lançar de novo é UPDATE, não INSERT.
  constraint notas_avaliacao_matricula_unica unique (avaliacao_id, matricula_id)
);
comment on table diario.notas is 'Nota de um aluno (via matrícula) numa avaliação.';

create index if not exists notas_matricula_idx on diario.notas (matricula_id);
create index if not exists notas_avaliacao_idx on diario.notas (avaliacao_id);

create table if not exists diario.aulas (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references selecao.turmas (id) on delete cascade,
  data date not null,
  horario time,
  descricao text,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
  -- Sem unique por data de propósito: pode haver mais de uma aula no
  -- mesmo dia (manhã e tarde), o design não sugere o contrário.
);
comment on table diario.aulas is 'Aula individual de uma turma — data, horário e descrição opcional.';

create index if not exists aulas_turma_data_idx on diario.aulas (turma_id, data);

create table if not exists diario.presencas (
  id uuid primary key default gen_random_uuid(),
  aula_id uuid not null references diario.aulas (id) on delete cascade,
  matricula_id uuid not null references selecao.matriculas (id) on delete cascade,
  presente boolean not null,
  registrada_em timestamptz not null default now(),
  registrada_por uuid not null references identidade.profiles (id),
  -- Uma presença por aluno por aula — refazer a chamada é UPDATE.
  constraint presencas_aula_matricula_unica unique (aula_id, matricula_id)
);
comment on table diario.presencas is 'Presença de um aluno (via matrícula) numa aula.';

create index if not exists presencas_matricula_idx on diario.presencas (matricula_id);
create index if not exists presencas_aula_idx on diario.presencas (aula_id);

-- atualizado_em mantido por trigger, função local ao schema — mesmo
-- padrão dos demais módulos (fronteira de schema é real, ver CLAUDE.md).
create or replace function diario.set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists avaliacoes_set_atualizado_em on diario.avaliacoes;
create trigger avaliacoes_set_atualizado_em
  before update on diario.avaliacoes
  for each row
  execute function diario.set_atualizado_em();

drop trigger if exists aulas_set_atualizado_em on diario.aulas;
create trigger aulas_set_atualizado_em
  before update on diario.aulas
  for each row
  execute function diario.set_atualizado_em();
