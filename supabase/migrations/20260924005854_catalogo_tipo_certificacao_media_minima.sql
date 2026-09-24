-- MS2/MS5 — a trilha passa a configurar como certifica e qual a média
-- mínima de aprovação. Antes, ambos eram fixos no sistema: certificado
-- só ao concluir a trilha inteira, e média mínima 6.0 embutida no código
-- de encerramento (diario.encerrar_matricula).

-- 'modulo': cada módulo concluído gera um certificado próprio.
-- 'trilha': certificado só ao concluir todos os módulos (comportamento
-- histórico).
create type catalogo.tipo_certificacao as enum ('modulo', 'trilha');

-- Default 'trilha' de propósito: preserva o comportamento atual de toda
-- trilha já existente sem precisar migrar dado nenhum.
alter table catalogo.trilhas
  add column tipo_certificacao catalogo.tipo_certificacao not null default 'trilha';

-- Default 6.00 pelo mesmo motivo: é o valor que estava embutido no código
-- hoje, então trilhas existentes continuam exigindo 6.0 sem intervenção.
alter table catalogo.trilhas
  add column media_minima numeric(4, 2) not null default 6.00,
  add constraint trilhas_media_minima_faixa check (media_minima between 0 and 10);

comment on column catalogo.trilhas.tipo_certificacao is
  'modulo = um certificado por módulo concluído; trilha = um certificado ao concluir a trilha inteira (default, comportamento histórico).';
comment on column catalogo.trilhas.media_minima is
  'Média mínima de aprovação da trilha (0 a 10). Usada por diario.encerrar_matricula no lugar do antigo literal 6.0.';
