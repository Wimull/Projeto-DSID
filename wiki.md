# Wiki-DSID

# Uno Distribuído

## Visão Geral

Uno Distribuído é um protótipo de jogo de Uno que explora uma arquitetura peer-to-peer com controle de estado por contrato em uma aplicação desktop moderna. O objetivo é permitir que vários jogadores participem de uma partida distribuída usando Electron, React e TypeScript, Node.js com troca de mensagens em tempo real via TCP.

---

## Objetivo do Projeto

- Construir um sistema de Uno em que cada jogador mantenha uma cópia local do estado do jogo.
- Implementar validação de ações por consenso entre os pares antes de aplicar qualquer mudança de estado.
- Estudar e aplicar um modelo de comunicação distribuída baseado em contrato.
- Garantir execução em duas ou mais máquinas para simular um ambiente real.

---

## Limitações Conhecidas

- Cada executável pode visualizar a mão de outros jogadores e o baralho, porém isso fica omitido para o jogador, apenas sendo possível acessar usando um explorador de memória.
- O sistema ainda não resolve problemas de confidencialidade.

---

## Modelo Estudado e Escolhido

- Modelo estudado: Peer-to-Peer
- Modelo adotado: Peer-to-Peer com controle lógico centralizado por sala

Cada participante é um nó ativo que:
- Mantém uma cópia do estado
- Participa da validação das ações
- Contribui para o consenso distribuído

Existe um nó "líder" que agrega as informações, como por exemplo as mensagens de decisões de cada jogador, e distribui para os demais.
- Ele é um nó eleito por todos os jogadores e poderá mudar ao passar do tempo.
- Inicialmente, o nó líder será o criador da sala.

---

## Arquitetura de Software

- Plataforma: Electron
- Interface: React + TypeScript
- Comunicação: TCP persistentes + Node.js

### Arquitetura de Mensagens por Contrato

- Toda ação é enviada para todos os pares
- Cada nó valida localmente a mensagem
- A ação só é aplicada após consenso coletivo
- Middleware garante integridade antes de alterar o estado

---

## Nomeação e Processos

### Nomeação

**Recursos identificados**
- `playerID` → jogador
- `roomID` → sala
- `messageID` → mensagem 

**Esquema de nomeação**
- Nome puro (com identificador, cada nó possui um id único associado a ele)

**Resolução de nomes**
- Tabela de mapeamento (lookup direto)

---

### Processos

**Uso de threads**
- Sim, para:
  - Recepção de mensagens
  - Processamento concorrente
  - Atualização de estado (atualiza o estado dentro da camada de comunicação primeiro numa thread separada e depois comunica ela para o front-end na main thread devido as limitações do JS em front-end)

**Modelo de servidor**
- Stateful 
- Estado mantido localmente e sincronizado via consenso

**Virtualização**
- Uso de containers (Docker)
- Facilita testes distribuídos e replicação de ambiente

---

### Sincronização e Controle

**Sincronização**
- Não necessária  
- Algoritmo de consenso e jogo em turno já garantem a sincronicidade

**Exclusão mútua distribuída**
- Não necessária  
- Consenso e jogo baseado em turno já garante consistência

**Algoritmo de eleição**
- Sim  
- Algoritmo em corrente  
- Define o controlador da sala

---

### Comunicação Avançada

**Uso de Pub/Sub**
- Não utilizado  
- Comunicação direta via TCP (broadcast controlado)

---

## Papéis e Funções

- Um jogador assume o papel de **controlador da sala**
- Responsável por:
  - Descobrir o IPs dos jogadores
  - Ajudar na descoberta inicial de pares
  - Sincronizar o estado da aplicação entre os nós
- O controlador **não decide sozinho**
- Toda decisão depende do consenso dos nós

---

## Comunicação

### Tipo

- Síncrona
- Conexões persistentes

### Protocolo

- TCP
- Comunicação orientada a eventos
- Formato JSON
- Uso de keepAlive para manter conexões

---

## Formato de Mensagens

```json
{
  "type": "string",
  "seq": 1,
  "data": any //(pacote de dados que muda a partir do tipo da mensagem. Sua estrutura interna é definida por esse tipo.)
}
```

---

## Tipos de Mensagens

- `action` → ação de jogo  
- `agree` → validação positiva  
- `disagree` → rejeição  
- `keepAlive` → manter conexão  
- `ACK` → confirmação de recebimento  
- `ERR` → erro  

---

## Validação e Middleware

- Todas as mensagens passam por validação antes de alterar o estado  

### Verificações incluem:

- Estrutura (JSON válido)  
- Sequência (`seq`)  
- Regras do jogo  

### Fluxo

1. Recebe mensagem  
2. Valida contrato  
3. Responde com `agree` ou `disagree`  
4. Só aplica mudança se houver consenso  

---

## Testes

- Testes manuais  
- Execução em múltiplas máquinas  

### Cenários

- Conexão entre jogadores  
- Envio de ações e consenso  
- Desconexão de pares  
- Reconexão e sincronização  
- Verificação de `keepAlive`  

---

## Diagrama de Sequência (Lógico)

1. Jogador A envia `action`  
2. Todos os pares recebem  
3. Cada nó valida  
4. Respondem com `agree` ou `disagree`  
5. Se todos concordarem:
   - Estado é atualizado  
6. Caso contrário:
   - A ação é abortada  
7. `keepAlive` mantém conexões  

---

## Caminho Futuro e Melhorias

- Proteger informações (mãos e baralho)  
- Implementar consenso tolerante a falhas  
- Criar testes automatizados  
- Melhorar descoberta de peers (sem IP fixo)  

---

# Replicação de Dados

## Dados Replicados

O sistema utiliza replicação completa entre os participantes da partida.

Cada nó mantém localmente uma cópia dos seguintes dados:

* Estado do baralho principal
* Cartas já descartadas na mesa
* Cartas presentes na mão de cada jogador
* Ordem dos turnos
* Histórico de ações executadas
* Estado atual da partida
* Informações da sala
* Mensagens de consenso e validação

Essa abordagem permite que qualquer participante possua uma visão completa do estado do jogo e possa validar independentemente as ações recebidas.

---

## Distribuição das Réplicas

### Estratégia de Distribuição

* Distribuição estática

Ao ingressar na partida, cada jogador recebe uma réplica completa do estado inicial do jogo.

O criador da sala é responsável por distribuir o estado inicial e os dados necessários para sincronização dos participantes.

Após a inicialização, todos os nós passam a manter suas cópias atualizadas através do protocolo de consenso.

---

# Consistência

## Modelo de Consistência

O sistema adota um modelo de **Consistência Forte (Strong Consistency)**.

Características:

* Toda leitura retorna o estado mais recentemente confirmado.
* Alterações de estado somente são aplicadas após consenso.
* Nenhum nó pode atualizar localmente o jogo sem validação coletiva.
* Todos os participantes observam a mesma sequência lógica de eventos.

Esse modelo foi escolhido para evitar divergências entre os estados locais dos jogadores e garantir a integridade das partidas.

---

## Protocolo de Consistência

### Algoritmo Utilizado

* Raft

O protocolo Raft foi escolhido devido à sua simplicidade de implementação e facilidade de entendimento quando comparado a alternativas como Paxos.

Responsabilidades do protocolo:

* Eleição de líder
* Replicação de comandos
* Garantia de ordenação das ações
* Recuperação após falhas do líder

### Implementação

Será utilizada uma biblioteca Node.js compatível com Electron:

* `liferaft`

A biblioteca será integrada à camada de comunicação para coordenar o consenso entre os participantes da sala.

---

# Tolerância a Falhas

## Prioridade do Sistema

Entre disponibilidade e confiabilidade, o projeto prioriza:

### Confiabilidade

Como se trata de um jogo baseado em turnos, é mais importante garantir que:

* Todas as ações sejam recebidas corretamente.
* O estado permaneça consistente.
* Nenhuma jogada seja aplicada incorretamente.

Em situações de falha, a depender do tipo dela, o jogador que ocasionou a falha será retirado da partida ou então será feita uma nova eleição de líder, que se não for possível, resultará no cancelamento da partida.

---

## Falhas Toleradas

### Falhas Bizantinas

Parcialmente tratadas através da validação distribuída.

Cada jogador possui conhecimento suficiente do estado para validar as ações recebidas.

Caso o nó líder envie informações incompatíveis com o estado local:

1. A inconsistência é detectada.
2. O líder é considerado suspeito.
3. Uma nova eleição é iniciada.
4. Caso não seja possível estabelecer um novo líder, a partida é encerrada.

**Observação:** o sistema não implementa um protocolo formal de tolerância bizantina (como PBFT), portanto falhas bizantinas não são totalmente suportadas.

---

### Falhas Temporais

Toleradas dentro de limites pré-definidos.

Mecanismo utilizado:

* KeepAlive
* Timeout de 5 segundos

Fluxo:

1. Um nó deixa de responder.
2. O timeout é atingido.
3. O nó é considerado indisponível.
4. O jogador é então desconectado da partida.

---

### Falhas por Resposta

Não toleradas.

Respostas incorretas comprometem a integridade do estado distribuído e levam ao cancelamento da conexão com o jogador problemático.

---

### Falhas por Omissão

Não toleradas.

A ausência de mensagens impede a validação do consenso necessário para prosseguir com a partida e portando o jogador é retirado da sala.

---

### Falhas por Crash

Não toleradas durante uma partida ativa.

Caso um participante crítico falhe, o sistema interrompe a conexão para dar prosseguimento com a partada.

---

## Quantidade de Falhas Suportadas

O sistema suporta:

* Até 1 processo falhante

A partir de duas falhas simultâneas, a manutenção do consenso e da consistência torna-se inviável para o modelo adotado.

---

# Detecção de Falhas

## Estratégia Utilizada

A detecção de falhas ocorre através da combinação de:

### KeepAlive

Mensagens periódicas são enviadas entre os participantes para confirmar que os nós permanecem ativos.

### Timeout

Caso um nó não responda dentro de 5 segundos:

* O nó é marcado como indisponível.
* O líder pode ser substituído.
* A partida pode ser encerrada caso a consistência não possa ser garantida.

### Validação de Jogadas

Todas as ações recebidas são verificadas contra:

* Estado local
* Regras do Uno
* Sequência de eventos

Qualquer divergência é tratada como possível falha ou comportamento incorreto do nó emissor.

---

# Considerações sobre CAP Theorem

O projeto prioriza:

* **Consistency (C)**
* **Partition Tolerance (P)**

Em caso de falha de comunicação ou perda de consenso, a disponibilidade da partida pode ser sacrificada para garantir que nenhum estado inconsistente seja propagado entre os participantes.

Portanto, a arquitetura aproxima-se de um modelo **CP** segundo o Teorema CAP.


## Conclusão

Este projeto demonstra como construir um sistema distribuído baseado em consenso usando um jogo simples como estudo de caso. A arquitetura peer-to-peer com validação por contrato garante consistência do estado mesmo sem um servidor central tradicional, enquanto conexões TCP permitem comunicação eficiente em tempo real.
