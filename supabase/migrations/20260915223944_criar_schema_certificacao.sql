-- MS5 — Certificação: reconhece formalmente a conclusão de uma TRILHA
-- (não de uma matrícula/módulo isolado) e emite um documento verificável
-- publicamente. Fecha o ciclo do aluno no Klass.

create schema if not exists certificacao;
comment on schema certificacao is 'MS5 — Certificação: emissão e verificação de certificados de conclusão de trilha.';

-- Certificado é da TRILHA. Um aluno conclui uma trilha ao ter status
-- 'concluida' em uma matrícula de cada módulo dela (cada módulo é uma
-- matrícula separada no MS3). Esta tabela consolida essas matrículas num
-- único documento.
--
-- Os campos denormalizados (aluno_nome, trilha_nome, carga horária,
-- metadata) são CONGELADOS no momento da emissão: o PDF precisa ser
-- reprodutível igual pra sempre. Se a trilha for renomeada ou um módulo
-- editado depois, o certificado já emitido mantém os dados originais.
create table if not exists certificacao.certificados (
  id uuid primary key default gen_random_uuid(),
  -- Código verificável impresso no PDF e digitado na verificação pública.
  -- Formato KLASS-<ano>-<8 chars> restrito por check para casar com o que
  -- a função geradora produz e com o que a rota /verificar/:hash espera.
  hash_publico text not null unique,
  -- on delete restrict: aluno/trilha com certificado emitido é histórico,
  -- não pode ser apagado por baixo de um documento que já existe no mundo.
  aluno_id uuid not null references identidade.profiles (id) on delete restrict,
  trilha_id uuid not null references catalogo.trilhas (id) on delete restrict,
  emitido_em timestamptz not null default now(),

  -- Dados congelados (denormalizados) ---------------------------------
  aluno_nome text not null,
  trilha_nome text not null,
  -- Soma das cargas horárias dos módulos da trilha no momento da emissão.
  trilha_carga_horaria_total integer not null,
  -- Estrutura livre com o detalhamento do histórico congelado. Schema
  -- esperado (ver packages/types MetadataCertificado):
  --   { "modulos": [ { "nome", "professor", "carga_horaria_horas",
  --     "nota_final", "periodo_inicio", "periodo_fim" } ] }
  metadata jsonb not null default '{}'::jsonb,

  -- Um único certificado por (aluno, trilha). Re-emissão fica para
  -- extensão futura; a constraint garante que refazer um módulo reprovado
  -- e reconcluir a trilha não duplica o documento.
  constraint certificados_aluno_trilha_unico unique (aluno_id, trilha_id),
  constraint certificados_hash_formato check (hash_publico ~ '^KLASS-\d{4}-[A-Z0-9]{8}$')
);
comment on table certificacao.certificados is
  'Certificado de conclusão de trilha, com dados congelados na emissão e hash público verificável.';
comment on column certificacao.certificados.metadata is
  'jsonb congelado: { modulos: [{ nome, professor, carga_horaria_horas, nota_final, periodo_inicio, periodo_fim }] }.';

-- hash_publico já ganha índice único pela constraint unique; explicitado
-- aqui só a leitura por aluno, que é o acesso do painel do aluno.
create index if not exists certificados_aluno_id_idx on certificacao.certificados (aluno_id);
