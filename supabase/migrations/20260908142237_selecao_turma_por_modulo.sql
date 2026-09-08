-- Correção de modelagem: turma passa a ser oferta de UM MÓDULO, não de
-- uma trilha inteira. Confirmado pelos SVGs 04 (boletim lista uma linha
-- por disciplina, cada uma com um professor diferente — Helena Costa,
-- Rafael Lima, Marcos Vieira) e 05 (tela do professor mostra
-- "Turma CDA-2026-1 · Ciência de Dados Aplicada" e "Disciplina:
-- Programação para Dados" lado a lado, com "40 aulas (80h)" batendo
-- exatamente com a carga horária do módulo). O card "MEU CURSO" do SVG
-- 03 é um resumo agregado da trilha, não uma matrícula literal.
--
-- Como pre_requisitos_modulo (MS2) já cobre pré-requisito entre módulos
-- da mesma trilha, e o próprio comentário daquela tabela já dizia "o MS3
-- consulta isso na hora da inscrição", a tabela selecao.pre_requisitos_trilha
-- criada antes deste ajuste não tem mais função — cai fora do escopo.

-- Dados de teste existentes (turmas/matrículas do modelo antigo, por
-- trilha) não têm correspondência limpa no novo modelo — apagados aqui
-- para os seeds recriarem do zero no modelo por módulo.
delete from selecao.matriculas;
delete from selecao.turmas;

alter table selecao.turmas drop constraint if exists turmas_trilha_id_fkey;
alter table selecao.turmas rename column trilha_id to modulo_id;
alter table selecao.turmas
  add constraint turmas_modulo_id_fkey foreign key (modulo_id)
  references catalogo.modulos (id) on delete restrict;

drop index if exists selecao.turmas_trilha_id_idx;
create index if not exists turmas_modulo_id_idx on selecao.turmas (modulo_id);

-- Vem do MS3 porque é config de turma (definida pela coordenação junto
-- com vagas/período), mas o MS4 é quem primeiro consome esse valor para
-- decidir aprovação por frequência.
alter table selecao.turmas
  add column frequencia_minima_percentual smallint not null default 75,
  add constraint turmas_frequencia_minima_valida
    check (frequencia_minima_percentual between 0 and 100);

-- pre_requisitos_trilha e seu trigger anti-ciclo saem inteiros: MS3 volta
-- a usar catalogo.pre_requisitos_modulo, que já existia desde o MS2.
drop trigger if exists pre_requisitos_trilha_impedir_ciclo on selecao.pre_requisitos_trilha;
drop function if exists selecao.impedir_ciclo_pre_requisito_trilha();
drop table if exists selecao.pre_requisitos_trilha;
