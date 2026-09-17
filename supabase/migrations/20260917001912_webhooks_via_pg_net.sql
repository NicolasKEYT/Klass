-- Notificação de eventos ao Worker via pg_net, direto de triggers nossos.
--
-- DESVIO DOCUMENTADO (ver CLAUDE.md "Fidelidade ao artigo"): o artigo/
-- CLAUDE.md descrevem "trigger detecta mudança e dispara Database Webhook".
-- O recurso "Database Webhooks" do painel do Supabase é, por baixo, um
-- trigger que chama supabase_functions.http_request() (também via pg_net).
-- NESTE projeto o schema interno `supabase_functions` nunca foi provisionado
-- (bug conhecido de provisionamento do Supabase: supabase/postgres#1152,
-- supabase/cli#925), então tentar criar qualquer Database Webhook pelo
-- painel falha com "schema supabase_functions does not exist" — e os dois
-- e-mails (aceite de matrícula do MS3 e certificado do MS5) nunca dispararam.
--
-- Solução: manter EXATAMENTE o mesmo padrão do artigo (trigger → HTTP →
-- Worker), mas com a chamada HTTP feita pelo nosso próprio trigger via
-- net.http_post(), sem depender do wrapper quebrado. Bônus de alinhamento
-- com o CLAUDE.md: a lógica passa a viver 100% em migration versionada, em
-- vez de configuração manual no painel.

create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- O WEBHOOK_SECRET não entra neste arquivo (regra do projeto: nada de
-- segredo versionado). Fica no Supabase Vault com o nome 'webhook_secret';
-- estas funções o leem por nome. O valor é inserido fora da migration
-- (mesmo valor do `wrangler secret put WEBHOOK_SECRET` do Worker).
-- URL pública do Worker fixa aqui de propósito: não é segredo e o projeto
-- usa o mesmo Supabase para dev/prod (um único endereço).

-- selecao: e-mail de aceite quando a matrícula é deferida (inscrita ->
-- matriculada). Monta o mesmo payload que o Database Webhook do Supabase
-- mandaria, então o handler do Worker (receberMatriculaDeferida) não muda.
create or replace function selecao.notificar_matricula_deferida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if old.status = 'inscrita' and new.status = 'matriculada' then
    select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'webhook_secret' limit 1;

    perform net.http_post(
      url := 'https://klass-workers.nicolasbr56.workers.dev/webhooks/matricula-deferida',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(v_secret, '')
      ),
      body := jsonb_build_object(
        'type', 'UPDATE',
        'table', 'matriculas',
        'schema', 'selecao',
        'record', to_jsonb(new),
        'old_record', to_jsonb(old)
      )
    );
  end if;
  return null; -- AFTER trigger: retorno não é usado.
end;
$$;

drop trigger if exists matriculas_notifica_deferimento on selecao.matriculas;
create trigger matriculas_notifica_deferimento
  after update on selecao.matriculas
  for each row
  execute function selecao.notificar_matricula_deferida();

-- certificacao: e-mail de conclusão quando um certificado é emitido. O
-- trigger de emissão (matriculas_emitir_certificado) faz o INSERT; este
-- reage a esse INSERT e avisa o Worker. Payload no formato do webhook do
-- Supabase, para o handler (receberCertificadoEmitido) não mudar.
create or replace function certificacao.notificar_certificado_emitido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'webhook_secret' limit 1;

  perform net.http_post(
    url := 'https://klass-workers.nicolasbr56.workers.dev/webhooks/certificado-emitido',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_secret, '')
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'certificados',
      'schema', 'certificacao',
      'record', to_jsonb(new)
    )
  );
  return null;
end;
$$;

drop trigger if exists certificados_notifica_emissao on certificacao.certificados;
create trigger certificados_notifica_emissao
  after insert on certificacao.certificados
  for each row
  execute function certificacao.notificar_certificado_emitido();
