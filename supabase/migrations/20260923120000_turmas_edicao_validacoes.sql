-- Ajustes de coordenação sobre selecao.turmas (feedback de uso diário):
--   * item 8 — o padrão de código era rígido demais (sigla limitada a 8
--     caracteres, um único formato). Ampliado para 2 a 3 segmentos
--     alfanuméricos separados por hífen, mantendo validação básica.
--   * item 5 — o campo de período aceitava ano com dígitos demais (ex.:
--     5 dígitos via input de data nativo). Adiciona faixa de ano razoável
--     como garantia no banco, independente do front.
--   * item 7 — passa a existir edição de turma; reduzir vagas abaixo do
--     número de alunos já matriculados precisa ser impedido pelo banco,
--     não só pela tela.

-- item 8 — código de turma: padrão mais flexível.
-- Antes: '^[A-Z0-9]{2,8}-[0-9]{4}-[0-9]{1,2}$' (sigla até 8, ano com 4
-- dígitos, sequência numérica). 'MOD2TEST1-2026-1' falhava só porque a
-- sigla tinha 9 caracteres. Agora: 2 a 3 segmentos de letras/números
-- (o primeiro com ao menos 2 caracteres), separados por hífen, sem
-- espaços, com um teto de tamanho para não virar texto livre.
alter table selecao.turmas drop constraint if exists turmas_codigo_formato;
alter table selecao.turmas
  add constraint turmas_codigo_formato check (
    codigo ~ '^[A-Z0-9]{2,}(-[A-Z0-9]+){1,2}$'
    and char_length(codigo) <= 30
  );

-- item 5 — período com ano numa faixa sã. O tipo date aceitaria anos de
-- 5+ dígitos; o input nativo do navegador chega a produzir isso. Trava
-- a faixa no banco (o front também limita via min/max, mas a garantia
-- fica aqui).
alter table selecao.turmas
  add constraint turmas_periodo_ano_razoavel check (
    extract(year from periodo_inicio) between 2000 and 2100
    and extract(year from periodo_fim) between 2000 and 2100
  );

-- item 7 — invariante da edição de turma: vagas_total nunca abaixo do
-- número de alunos já matriculados (status 'matriculada'). Inscrições
-- ainda pendentes ('inscrita') não contam aqui — podem ser recusadas.
-- SECURITY DEFINER + search_path vazio para a contagem não depender da
-- RLS de quem está editando.
create or replace function selecao.impedir_vagas_abaixo_dos_matriculados()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_matriculados integer;
begin
  if new.vagas_total >= old.vagas_total then
    return new; -- aumentar ou manter vagas nunca fere a invariante
  end if;

  select count(*) into v_matriculados
  from selecao.matriculas
  where turma_id = new.id and status = 'matriculada';

  if new.vagas_total < v_matriculados then
    raise exception
      'Esta turma já tem % aluno(s) matriculado(s); as vagas não podem ficar abaixo disso.',
      v_matriculados;
  end if;

  return new;
end;
$$;

drop trigger if exists turmas_impedir_vagas_abaixo_dos_matriculados on selecao.turmas;
create trigger turmas_impedir_vagas_abaixo_dos_matriculados
  before update of vagas_total on selecao.turmas
  for each row
  execute function selecao.impedir_vagas_abaixo_dos_matriculados();
