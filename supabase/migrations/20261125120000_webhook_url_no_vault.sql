-- A URL do Worker deixa de ficar fixa nas três funções de webhook: passa a vir
-- do Vault (nome 'webhook_url', URL base do Worker sem barra final), como já
-- vem o segredo ('webhook_secret'). Quem adota o Klass grava a própria URL no
-- Vault, sem editar migration. Cada função monta '<webhook_url>/webhooks/<rota>'.
--
-- Sem 'webhook_url' no Vault, a função retorna sem chamar net.http_post: o
-- evento não é enviado a lugar nenhum (nem ao Worker de outra instalação).
-- ATENÇÃO ao aplicar no hospedado: antes do `db push`, rodar lá
--   select vault.create_secret('<URL do Worker>', 'webhook_url');
-- senão os três e-mails (inscrição recebida, matrícula deferida, certificado
-- emitido) deixam de sair.
--
-- Nomes das funções e dos triggers não mudam; os triggers continuam os mesmos.

create or replace function selecao.notificar_inscricao_recebida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_url text;
begin
  if new.status = 'inscrita' then
    select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'webhook_url' limit 1;
    if coalesce(v_url, '') = '' then
      return null;
    end if;

    select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'webhook_secret' limit 1;

    perform net.http_post(
      url := v_url || '/webhooks/inscricao-recebida',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(v_secret, '')
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'matriculas',
        'schema', 'selecao',
        'record', to_jsonb(new)
      )
    );
  end if;
  return null; -- AFTER trigger: retorno não é usado.
end;
$$;

create or replace function selecao.notificar_matricula_deferida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_url text;
begin
  if old.status = 'inscrita' and new.status = 'matriculada' then
    select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'webhook_url' limit 1;
    if coalesce(v_url, '') = '' then
      return null;
    end if;

    select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'webhook_secret' limit 1;

    perform net.http_post(
      url := v_url || '/webhooks/matricula-deferida',
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

create or replace function certificacao.notificar_certificado_emitido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_url text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'webhook_url' limit 1;
  if coalesce(v_url, '') = '' then
    return null;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'webhook_secret' limit 1;

  perform net.http_post(
    url := v_url || '/webhooks/certificado-emitido',
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
