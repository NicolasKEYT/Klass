-- MS2 — terceiro modo de certificação da trilha (item C8 da auditoria):
-- 'modulo_e_trilha' = cada módulo concluído gera o certificado do módulo
-- e, ao concluir todos os módulos, sai também o certificado da trilha.
--
-- Migration própria de propósito: um valor novo de enum não pode ser usado
-- na mesma transação em que é criado (o Postgres recusa com "unsafe use of
-- new value"). As funções que o usam (certificacao.ao_concluir_matricula)
-- são recriadas na migration seguinte, já em outra transação.
alter type catalogo.tipo_certificacao add value if not exists 'modulo_e_trilha';

comment on column catalogo.trilhas.tipo_certificacao is
  'modulo = um certificado por módulo concluído; trilha = um certificado ao concluir a trilha inteira (default, comportamento histórico); modulo_e_trilha = os dois.';
