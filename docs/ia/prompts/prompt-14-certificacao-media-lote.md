# Prompt 14 — Certificação Configurável, Média Mínima e Encerramento em Lote

Você vai implementar três extensões relacionadas ao ciclo de vida da
matrícula e certificação, decididas e confirmadas pelo usuário. Leia o
`CLAUDE.md` antes de começar. Este prompt tem schema novo — trate cada
decisão de design com cuidado e pare para perguntar se encontrar
ambiguidade genuína.

## Contexto

MS4 (Diário) e MS5 (Certificação) estão completos e em produção. Este
prompt adiciona três capacidades que não existiam:

1. A coordenação escolhe, ao criar (ou editar) uma trilha, se a
   certificação é **por módulo** (cada módulo concluído gera um
   certificado próprio) ou **por conclusão geral** (certificado só ao
   completar todos os módulos da trilha — comportamento atual, mantido
   como default).
2. A coordenação define, no mesmo lugar, a **média mínima** de
   aprovação da trilha (hoje fixa em 6.0 para todo o sistema).
3. O professor pode **encerrar a turma inteira de uma vez** (todos os
   alunos matriculados, cada um avaliado individualmente pelos próprios
   critérios), em vez de encerrar aluno por aluno. A coordenação ganha
   o poder simétrico de **reativar a turma inteira**, além do
   "desfazer encerramento" que já existe por aluno.

## 1. Migration: tipo de certificação e média mínima por trilha

```bash
supabase migration new catalogo_tipo_certificacao_media_minima
```

- ENUM `catalogo.tipo_certificacao` com valores `'modulo'`, `'trilha'`.
- Coluna `catalogo.trilhas.tipo_certificacao catalogo.tipo_certificacao
  not null default 'trilha'` — o default preserva o comportamento atual
  para trilhas já existentes.
- Coluna `catalogo.trilhas.media_minima numeric(4,2) not null default
  6.00`, com `check (media_minima between 0 and 10)`.

Comente o porquê do default de cada coluna (preservar comportamento
existente sem migração de dados).

## 2. Migration: schema de `certificacao` para suportar os dois tipos

```bash
supabase migration new certificacao_por_modulo
```

- Adicione `certificacao.certificados.modulo_id uuid null references
  catalogo.modulos(id) on delete restrict`. `null` significa
  certificado de trilha completa (comportamento atual); preenchido
  significa certificado de um módulo específico.
- **Atenção à unicidade:** a constraint atual provavelmente é `unique
  (aluno_id, trilha_id)`. Isso não pode continuar como está, porque
  agora pode haver várias linhas por (aluno, trilha) quando o tipo é
  "por módulo" — uma por módulo. Ajuste para dois índices únicos
  parciais:
  - Um para certificado de trilha completa: único por
    `(aluno_id, trilha_id)` **onde `modulo_id is null`**.
  - Um para certificado de módulo: único por
    `(aluno_id, modulo_id)` **onde `modulo_id is not null`**.

  (Lembre-se: `NULL` nunca é igual a `NULL` em uma constraint única
  comum, então uma constraint única simples não protegeria contra
  duplicata de certificado de trilha completa se você não usar os
  índices parciais.)
- Adicione ao `metadata` (ou colunas próprias, o que for mais coerente
  com o que já existe) os dados específicos de um certificado de
  módulo: nome do módulo, carga horária, professor, nota final,
  período — o equivalente ao que já existe para trilha, em escopo
  menor.

## 3. Função de emissão: respeitar o tipo de certificação da trilha

Localize a função de emissão atual (provavelmente
`certificacao.verificar_e_emitir`, chamada por trigger quando uma
matrícula muda para `concluida`). Ajuste a lógica:

- **Se `tipo_certificacao = 'trilha'`** (comportamento atual): mantém
  como está — só emite quando todos os módulos da trilha estão
  `concluida` para aquele aluno.
- **Se `tipo_certificacao = 'modulo'`**: emite um certificado
  imediatamente quando **aquela matrícula específica** muda para
  `concluida` — não espera as demais. Um aluno pode acumular vários
  certificados de módulo ao longo do tempo, um por módulo concluído,
  independente de quando (ou se) completa a trilha inteira.

Garanta que a função continua idempotente (chamar de novo para o mesmo
evento não duplica certificado — os índices únicos parciais do passo 2
garantem isso no nível do banco, mas trate o erro de violação de
unicidade graciosamente na função, sem quebrar o trigger).

## 4. Função de cálculo: média mínima por trilha

Localize `diario.encerrar_matricula` (ou equivalente). Hoje ela compara
a média calculada com um valor fixo (6.0). Ajuste para buscar
`media_minima` da trilha correspondente ao módulo da turma da matrícula
(via `turmas → modulos → trilhas`), e usar esse valor na comparação em
vez do literal fixo. A frequência mínima continua vindo da turma, como
já está.

## 5. Funções de encerramento e reativação em lote

**`diario.encerrar_turma(p_turma_id uuid) returns jsonb`:**

- Valida que quem chama é o professor da turma (ou coordenação) — mesmo
  padrão de `encerrar_matricula`.
- Busca todas as matrículas com status `matriculada` naquela turma.
- Para cada uma, tenta aplicar a mesma lógica de `encerrar_matricula`
  (refatore para uma função interna compartilhada em vez de duplicar
  código, se a estrutura atual permitir isso com pouco atrito).
- Matrículas que não estão prontas (`diario.pronto_para_encerrar`
  retorna false) são **puladas**, não travam o restante do lote.
- Retorna um resumo estruturado: quantas foram encerradas com sucesso
  (e com qual resultado — concluída/reprovada), e quantas foram
  puladas com o motivo (ex.: "faltam notas/chamadas").

**`diario.reativar_turma(p_turma_id uuid) returns jsonb`:**

- Só coordenação pode chamar.
- Busca todas as matrículas com status `concluida` ou `reprovada`
  naquela turma.
- Para cada uma, aplica a mesma lógica de
  `diario.desfazer_encerramento`.
- Retorna resumo estruturado (quantas reativadas).

Ambas `security invoker`, respeitando RLS de quem chama.

## 6. Frontend: formulário de trilha

Em `NovaTrilha` e `EditarTrilha`, no mesmo bloco/seção, adicione:

- Seletor (radio ou select) para "Tipo de certificação": **"Por
  módulo concluído"** ou **"Só ao concluir a trilha inteira"**, com uma
  frase de ajuda explicando a diferença em linguagem simples. Default
  visualmente igual ao que já vem do banco ("Só ao concluir a trilha
  inteira").
- Campo numérico para "Média mínima de aprovação" (0 a 10, aceita
  casas decimais), com valor padrão 6,0.

Se a trilha já tiver certificados emitidos e a coordenação tentar mudar
o tipo de certificação, mostre um aviso inline (não bloqueante)
explicando que certificados já emitidos não são afetados, só o
comportamento dali para frente.

## 7. Frontend: ação de encerrar turma (professor)

Na aba "Alunos" de `professor/DetalheTurma`, adicione um botão
"Encerrar turma" (nível de turma, não de aluno individual — visualmente
separado dos botões de encerrar por aluno que já existem). Ao clicar:

- Confirmação inline explicando o que vai acontecer (afeta todos os
  alunos matriculados, cada um avaliado pelos próprios critérios).
- Ao confirmar, chama `diario.encerrar_turma`, mostra o resumo
  retornado (quantos aprovados, quantos reprovados, quantos pulados e
  por quê) em um banner ou modal de resultado.
- Mantenha os botões de encerrar por aluno individual, para casos como
  aluno que entrou depois ou precisa de tratamento à parte.

## 8. Frontend: ação de reativar turma (coordenação)

Na visão de "Diário" (somente leitura) da coordenação em
`coordenacao/DetalheTurma`, adicione, ao lado do "Desfazer
encerramento" que já existe por aluno, um botão "Reativar turma
inteira". Mesma UX de confirmação inline, mesmo padrão de resumo de
resultado ao final.

## 9. Aluno: exibir os dois tipos de certificado

Em `/aluno/certificados`, ajuste a listagem para diferenciar
visualmente um certificado de módulo de um certificado de trilha
completa (ex.: rótulo "Certificado de módulo: [nome]" vs "Certificado
de trilha: [nome]"). O componente de PDF (`CertificadoPDF`) precisa de
uma variante mais simples para certificado de módulo (nome do módulo,
carga horária, professor, data — sem a lista de módulos que o de
trilha tem).

## 10. Seeds e validação end-to-end

Ajuste os seeds para cobrir os dois modos:

- A trilha "Ciência de Dados Aplicada" (ou outra já existente) mude
  para `tipo_certificacao = 'modulo'`, para você conseguir testar esse
  caminho com os dados que já existem.
- Mantenha ao menos uma trilha no modo `'trilha'` (o default).

Valide manualmente, em produção:

1. Como coordenação: cria ou edita uma trilha, escolhe "por módulo",
   define média mínima diferente de 6.0 (ex.: 7.0).
2. Como professor: encerra um módulo de um aluno nessa trilha — conta
   com o critério de 7.0, não 6.0 — e confirma que um certificado de
   **módulo** foi emitido (não espera a trilha inteira).
3. Aluno vê o certificado de módulo em `/aluno/certificados`, baixa o
   PDF, confirma que o hash funciona em `/verificar/:hash`.
4. Como professor, em uma turma com múltiplos alunos matriculados (use
   os seeds de teste — Ana/Bruno/Carla), clica "Encerrar turma" e
   confirma o resumo (algum aprovado, algum reprovado, algum pulado se
   fizer sentido no cenário).
5. Como coordenação, clica "Reativar turma inteira" na mesma turma e
   confirma que os alunos voltam para `matriculada`.

## Regras que valem para tudo

Reafirmando o `CLAUDE.md`: RLS em qualquer coisa nova; migrations
idempotentes; comentários em português explicando o porquê;
identificadores de domínio em português; "Salvar"/"Salvar e voltar" nos
formulários; confirmação inline, nunca `window.confirm()`.

## Ao terminar, me entregue

1. Resumo do schema novo (colunas, índices únicos parciais, funções).
2. Confirmação da validação end-to-end dos 5 passos acima.
3. Ambiguidades ou decisões próprias que tenha tomado.
4. `pnpm typecheck` e `pnpm build` limpos, CI verde.
5. Commits por tema, `git push` ao final.
6. **Uma nota específica**: como ficou o texto/rótulo da ação de
   encerrar por aluno individual (o professor achou "encerrar o
   módulo" confuso na visão dele) — se você ajustou a redação, descreva
   o que ficou.
