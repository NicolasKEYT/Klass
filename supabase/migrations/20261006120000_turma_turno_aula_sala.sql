-- MS3/MS4 — turno da turma e sala da aula (UI Kit, págs. 3, 6 e 11:
-- "AM-2026-2 · Noite", "Aula 12 · Sala 3"). Os dois são opcionais e de texto
-- curto, livres de propósito ("Noite", "Sábado", "Laboratório 2"): não há
-- cadastro de turnos nem de salas no domínio, e criar um só para isso seria
-- modelagem sem uso. Sem valor, a interface fica como antes.

alter table selecao.turmas
  add column if not exists turno text null,
  add constraint turmas_turno_tamanho check (
    turno is null or char_length(btrim(turno)) between 1 and 30
  );

comment on column selecao.turmas.turno is
  'Turno da turma, texto curto opcional (ex.: "Noite", "Sábado"). Exibido junto ao código.';

alter table diario.aulas
  add column if not exists sala text null,
  add constraint aulas_sala_tamanho check (
    sala is null or char_length(btrim(sala)) between 1 and 40
  );

comment on column diario.aulas.sala is
  'Sala da aula, texto curto opcional (ex.: "Sala 3", "Laboratório 2").';
