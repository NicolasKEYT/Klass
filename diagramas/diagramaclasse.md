```mermaid
flowchart LR
    %% Atores
    A((Aluno))
    G((Gestão))
    SE((Sistema de<br>E-mail))

    %% Sistema de Gestão Acadêmica
    subgraph SGA [Sistema de Gestão Acadêmica]
        direction TB
        UC1([Inscrever-se em Turma])
        UC2([Confirmar Participação])
        UC3([Visualizar Conteúdo/Avaliações])
        UC4([Abrir Turma - Divulgação])
        UC5([Selecionar Alunos - Aprovar/Recusar])
        UC6([Alterar Status da Turma])
        UC7([Emitir Certificados])

        UC1 -. "<<precede>>" .-> UC5
        UC6 -. "<<trigger>>" .-> UC2
    end

    %% Relacionamentos Atores -> Casos de Uso
    A --> UC1
    A --> UC2
    A --> UC3

    G --> UC4
    G --> UC5
    G --> UC6
    G --> UC7

    %% Invocações de serviço
    UC1 -. "<<invoke>>" .-> SE
    UC6 -. "<<invoke>>" .-> SE
    UC7 -. "<<invoke>>" .-> SE
