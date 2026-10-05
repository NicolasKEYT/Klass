-- MS4 — materiais da turma (pedido do dono do produto: "o professor faz
-- upload de arquivos igual ao Moodle; o aluno baixa ou visualiza no
-- navegador").
--
-- O arquivo mora no Supabase Storage, num bucket PRIVADO ("materiais"),
-- sob o prefixo da turma: <turma_id>/<nome>. A linha em diario.materiais é o
-- registro de domínio (título, quem enviou, quando). As duas pontas têm a
-- mesma regra de acesso:
--   * enviar e apagar: professor da turma e coordenação;
--   * ler: esses dois e o aluno com matrícula na turma (cursando ou já
--     encerrada — o material continua disponível depois do módulo).
-- Limites (20 MB; PDF, imagens, documentos/planilhas/apresentações do
-- Office e do LibreOffice, ZIP) valem no bucket (o Storage recusa o upload)
-- e na tabela (a linha só entra com o tamanho e o tipo REAIS do objeto,
-- lidos do Storage por trigger, não do que o navegador declarou).

-- Tipos aceitos: uma lista só, usada pelo bucket e pela tabela.
create or replace function diario.tipos_material_permitidos()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    'application/zip', 'application/x-zip-compressed'
  ]::text[];
$$;

create or replace function diario.tamanho_maximo_material()
returns bigint
language sql
immutable
set search_path = ''
as $$
  select 20 * 1024 * 1024::bigint;  -- 20 MB
$$;

grant execute on function diario.tipos_material_permitidos() to authenticated, service_role;
grant execute on function diario.tamanho_maximo_material() to authenticated, service_role;

-- Bucket privado. Idempotente: reaplicar só reforça os limites.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materiais', 'materiais', false, diario.tamanho_maximo_material(), diario.tipos_material_permitidos())
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Turma dona de um caminho do bucket ("<turma_id>/..."). null quando o
-- primeiro segmento não é um uuid — a política nega em vez de dar erro de
-- conversão.
create or replace function diario.turma_do_caminho(p_nome text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_nome, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_nome, '/', 1)::uuid
  end;
$$;

grant execute on function diario.turma_do_caminho(text) to authenticated, service_role;

-- Quem pode LER os materiais da turma: coordenação, professor da turma e
-- aluno com matrícula ativa ou encerrada. (Escrever = pode_gerenciar_turma.)
create or replace function diario.pode_ler_materiais(p_turma_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select p_turma_id is not null and (
    diario.pode_gerenciar_turma(p_turma_id)
    or exists (
      select 1 from selecao.matriculas m
      where m.turma_id = p_turma_id
        and m.aluno_id = auth.uid()
        and m.status in ('matriculada', 'concluida', 'reprovada')
    )
  );
$$;

revoke execute on function diario.pode_ler_materiais(uuid) from public, anon;
grant execute on function diario.pode_ler_materiais(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Políticas do bucket em storage.objects (por prefixo da turma).
create policy materiais_ler
  on storage.objects for select to authenticated
  using (bucket_id = 'materiais' and diario.pode_ler_materiais(diario.turma_do_caminho(name)));

create policy materiais_enviar
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'materiais'
    and diario.turma_do_caminho(name) is not null
    and diario.pode_gerenciar_turma(diario.turma_do_caminho(name))
  );

create policy materiais_apagar
  on storage.objects for delete to authenticated
  using (bucket_id = 'materiais' and diario.pode_gerenciar_turma(diario.turma_do_caminho(name)));

-- Sem política de UPDATE: arquivo enviado não é sobrescrito (trocar = apagar
-- e enviar de novo), então o registro nunca aponta para conteúdo diferente
-- do que foi conferido.

-- ---------------------------------------------------------------------------
create table if not exists diario.materiais (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references selecao.turmas (id) on delete cascade,
  titulo text not null,
  caminho text not null unique,
  nome_arquivo text not null,
  tipo_mime text not null,
  tamanho_bytes bigint not null,
  enviado_por uuid not null default auth.uid() references identidade.profiles (id) on delete restrict,
  enviado_em timestamptz not null default now(),
  constraint materiais_titulo_tamanho check (char_length(btrim(titulo)) between 1 and 150),
  constraint materiais_caminho_da_turma check (caminho like turma_id::text || '/%'),
  constraint materiais_tipo_permitido check (tipo_mime = any (diario.tipos_material_permitidos())),
  constraint materiais_tamanho_limite check (tamanho_bytes > 0 and tamanho_bytes <= diario.tamanho_maximo_material())
);
comment on table diario.materiais is
  'Material da turma (arquivo no bucket privado "materiais", em <turma_id>/...). Professor da turma e coordenação enviam/apagam; aluno com matrícula lê.';

create index if not exists materiais_turma_idx on diario.materiais (turma_id, enviado_em desc);

-- O tamanho e o tipo vêm do objeto já gravado no Storage (metadata real),
-- não do formulário: um navegador adulterado não registra um .exe como PDF.
create or replace function diario.conferir_material_no_storage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tamanho bigint;
  v_tipo text;
begin
  select (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype'
  into v_tamanho, v_tipo
  from storage.objects o
  where o.bucket_id = 'materiais' and o.name = new.caminho;

  if v_tipo is null then
    raise exception 'arquivo não encontrado no armazenamento: envie o arquivo antes de registrar o material';
  end if;

  new.tamanho_bytes := v_tamanho;
  new.tipo_mime := v_tipo;
  return new;
end;
$$;

drop trigger if exists materiais_confere_storage on diario.materiais;
create trigger materiais_confere_storage
  before insert on diario.materiais
  for each row
  execute function diario.conferir_material_no_storage();

alter table diario.materiais enable row level security;

grant select, insert, delete on diario.materiais to authenticated;
-- Só o título é editável (renomear); arquivo, tipo e tamanho não mudam.
grant update (titulo) on diario.materiais to authenticated;
grant all on diario.materiais to service_role;

create policy materiais_select
  on diario.materiais for select to authenticated
  using (diario.pode_ler_materiais(turma_id));

create policy materiais_insert
  on diario.materiais for insert to authenticated
  with check (diario.pode_gerenciar_turma(turma_id) and enviado_por = auth.uid());

create policy materiais_update
  on diario.materiais for update to authenticated
  using (diario.pode_gerenciar_turma(turma_id))
  with check (diario.pode_gerenciar_turma(turma_id));

create policy materiais_delete
  on diario.materiais for delete to authenticated
  using (diario.pode_gerenciar_turma(turma_id));
