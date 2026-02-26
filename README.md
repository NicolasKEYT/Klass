# -K-Klass-ERP
Sistema ERP para instituições de ensino acadêmico (Base do projeto) 

# CRUD DE GESTÃO DE CARREIRAS, TRILHAS E TURMAS

## Fluxo do Sistema

### 1. Abertura de Turma
- Ao abrir uma turma com **status de inscrições abertas**, o formulário é divulgado em redes sociais.  
- O aluno se inscreve (**demonstra interesse**):  
  - Recebe e-mail de confirmação para aguardar aprovação.  
  - Entra na lista de interessados daquela turma.  
  - A lista geral de alunos é atualizada (ex-alunos recebem um *merge* dos dados).  
  - **O sistema deve analisar se os pré-requisitos do curso estão sendo atendidos.**

---

### 2. Seleção de Alunos
- A gestão faz a seleção dos alunos:  
  - Lista de aprovados para o curso.  
  - Lista de espera de interessados.  
  - Lista de recusados.  

---

### 3. Alteração de Status da Turma
- Gestão altera o status da oferta da turma (da trilha) para **"Aguardando Início"**:  
  - Todos os aprovados recebem um e-mail de confirmação (precisam confirmar).  
  - São formadas duas listas:  
    - Lista de realmente confirmados.  
    - Lista de espera.  

- Gestão altera para **"Iniciada"** (pode ser automatizado pela data de início do curso):  
  - Status dos alunos aprovados muda para **Cursando**.  

---

### 4. Curso em Andamento
- Alunos cursam normalmente (avaliações e presença).  
- Baseado nas avaliações + presença → **Lista de aprovados**.  
- Geração de **certificados**.  
- Cada aprovado tem o status alterado para **Concluído**.  

---

### 5. Conclusão de Carreira
- Ao concluir **todos os cursos da carreira**, o aluno ainda recebe o **certificado da carreira**.  

---

## Motivação do Projeto
Este sistema nasce como alternativa ao programa atualmente utilizado no Mackenzie:

- O programa atual é **muito caro** (~400 dólares por usuário).  
- Possui **muitos problemas** na gestão de turmas e trilhas.  
- Ideia base: **dimensionar essa função para fora do programa atual**.  
- Solução proposta: **Open Source**.  


