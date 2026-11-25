-- E-mail de "inscrição recebida": avisa o aluno, logo após ele se inscrever,
-- que a coordenação vai analisar o pedido. Terceiro ponto de integração
-- trigger -> pg_net -> Worker, com o mesmo padrão dos dois de
-- 20260917001912_webhooks_via_pg_net.sql (matrícula deferida e certificado
-- emitido): o segredo vem do Vault ('webhook_secret'), a URL do Worker é a
-- mesma desse arquivo e a chamada é assíncrona e não é reenviada.
--
-- Dispara só para matrícula que nasce "inscrita". Todo o caminho real passa por
-- selecao.inscrever_aluno(), que não pega o status de fora; qualquer outra
-- inserção (por exemplo, a seed) com status diferente não gera e-mail.
--
-- Quem adotar o Klass troca a URL do Worker aqui também, não só na migration
-- 20260917001912 (ver README, "Webhooks do banco").

create or replace function selecao.notificar_inscricao_recebida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if new.status = 'inscrita' then
    select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'webhook_secret' limit 1;

    perform net.http_post(
      url := 'https://klass-workers.nicolasbr56.workers.dev/webhooks/inscricao-recebida',
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

drop trigger if exists matriculas_notifica_inscricao on selecao.matriculas;
create trigger matriculas_notifica_inscricao
  after insert on selecao.matriculas
  for each row
  execute function selecao.notificar_inscricao_recebida();
