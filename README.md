# Uno P2P

Implementação do jogo **Uno** como aplicação desktop (Electron + React), em que as partidas acontecem **peer-to-peer**, sem servidor central: cada jogador roda uma instância da aplicação que atua simultaneamente como **cliente** (interface) e **servidor de jogo** (estado + rede), conectando-se diretamente às instâncias dos outros jogadores por TCP.

## Sumário

- [Visão geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Modelo de consistência](#modelo-de-consistência)
- [Tolerância a falhas](#tolerância-a-falhas)
- [Stack técnica](#stack-técnica)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Como rodar](#como-rodar)
- [Fluxo de uma partida](#fluxo-de-uma-partida)

## Visão geral

O jogo segue as regras clássicas do Uno (compra, descarte, pular, reverter, +2, coringa, +4) para 2 a 4 jogadores. Não existe um servidor dedicado: o jogador que cria o lobby vira o **host** inicial, e todos os demais participantes se conectam diretamente a ele e entre si, formando uma malha (mesh) de conexões TCP. O host tem papel de coordenador do consenso, mas o estado do jogo é replicado em todos os participantes e pode ser reeleito dinamicamente caso o host caia.

## Arquitetura

Cada instância do Electron roda três camadas lógicas dentro do mesmo processo:

1. **Renderer (React / UI)** — `App.tsx`, `HomePage.tsx`, `LobbyPage.tsx`, `GamePage.tsx`. Não tem acesso direto ao Node.js; fala com a camada de servidor local através de `client-ipc.ts`, que expõe `send(name, args)` (RPC com Promise) e `listen(name, cb)` (assinatura de eventos push).
2. **Preload / "servidor embutido"** — `preload.ts` expõe via `contextBridge` as pontes `getServerSocket`, `ipcConnect` e `uuid` para o renderer, e inicializa localmente (no mesmo processo) o módulo de servidor (`server.ts`, `server-ipc.ts`, `server-handlers.ts`, `callbacks.ts`, `game.ts`) assim que recebe o evento `set-socket` do processo principal.
3. **Servidor local (IPC) + rede P2P (TCP)** — a comunicação **UI ↔ lógica de jogo**, dentro da mesma máquina, acontece via socket local do `node-ipc` (nome descoberto dinamicamente por `find-open-socket.ts`, testando `myapp1`, `myapp2`, ... até achar um livre — permite rodar múltiplas instâncias na mesma máquina para teste). Já a comunicação **entre jogadores diferentes** acontece por sockets TCP brutos (`net` do Node), abertos em `server.ts`, com mensagens JSON delimitadas por `\n` (necessário porque TCP é um fluxo de bytes e pode concatenar ou fragmentar mensagens — ver `handleIncomingData`).

```
Jogador A (Electron)                       Jogador B (Electron)
┌───────────────────────┐                  ┌───────────────────────┐
│ Renderer (React)       │                  │ Renderer (React)       │
│   client-ipc.ts        │                  │   client-ipc.ts        │
└──────────┬─────────────┘                  └──────────┬─────────────┘
           │ node-ipc (socket local)                    │ node-ipc (socket local)
┌──────────▼─────────────┐                  ┌──────────▼─────────────┐
│ Preload + server-*.ts   │◄──── TCP (net) ─►│ Preload + server-*.ts   │
│ game.ts / callbacks.ts  │   mensagens JSON │ game.ts / callbacks.ts  │
└─────────────────────────┘   \n-delimitadas └─────────────────────────┘
```

### Fluxo de conexão

- **Criar lobby** (`createLobby`): gera IDs, vira automaticamente o host.
- **Entrar em lobby** (`connectToLobby`): conecta via TCP no `ip:porta` informado, envia `TryConnect`.
- O host responde `ConnectionAccepted` com a lista de jogadores já conectados; o novo jogador então se conecta diretamente a **cada um deles** (`Connect`), formando a malha completa — todos falam com todos, não só com o host.

## Modelo de consistência

O jogo usa um modelo de **estado replicado com coordenação por líder e validação por quórum**, inspirado em ideias de eleição de líder ao estilo Raft:

- **Estado replicado:** cada peer mantém uma cópia completa do `Game` (baralho, mãos, carta na mesa, turno, sentido do jogo). O baralho é gerado deterministicamente a partir de uma *seed* (`mulberry32`) compartilhada no `StartGame`, garantindo que todos os clientes cheguem ao mesmo embaralhamento sem precisar transmitir o baralho inteiro.
- **Eleição de líder** (`callbacks.ts`): mantém `currentTerm`, `votedFor` e `leaderId`; a cada nova eleição, o candidato é escolhido deterministicamente (menor/maior `id` entre os conectados) e precisa de maioria (`> metade`) dos votos para assumir. Há um timer de eleição (5s) que dispara nova eleição se o líder ficar em silêncio.
- **Consenso por quórum nas jogadas** (`ActionDecision` / `ActionPassed` / `ActionDenied`): quando um jogador executa uma ação (comprar ou jogar carta), a jogada é proposta a todos os peers, que rodam `validateAction` localmente contra o estado que possuem e votam `pass`/`notPass`. A ação só é efetivada (`applyApprovedAction`) quando a maioria aprova — isso impede que um único peer (incluindo o próprio host) force um estado inválido sem que os demais concordem.
- **Detecção de host malicioso:** se o host tenta aplicar uma jogada que os outros peers consideram inválida (`ActionDenied` reprovado por `validateAction`), os clientes identificam a tentativa ("Host tentou roubar no jogo"), encerram a conexão com ele e disparam nova eleição de líder.
- **Entrega confiável sobre TCP:** cada mensagem de protocolo (exceto `ACK`) é numerada e reenviada automaticamente (`resendTimeoutFunction`, 1s) até receber confirmação (`ACK`) do destinatário, compensando perda de pacote/mensagem em trânsito.

## Tolerância a falhas

- **Heartbeat / Keep-alive:** cada peer envia `KeepAlive` a cada 5s; se nenhuma mensagem chega de um peer em 15s (`endConnectionTimeoutDelay`), ele é considerado desconectado e removido da partida.
- **Desconexão de jogador comum:** o jogador é removido de `connectedPlayersList` e da lista de jogadores da partida; se era a vez dele, o turno avança automaticamente para o próximo.
- **Queda do host/líder:** dispara `startLeaderElection`, elegendo um novo host entre os jogadores restantes e notificando todos (`changeHost`) para atualizar a UI.
- **Reenvio de mensagens não confirmadas:** garante que instabilidades momentâneas de rede não derrubem a sincronização do estado.
- **Fila de mensagens do cliente:** se a UI tentar enviar algo antes do socket local estar pronto, a mensagem fica em `messageQueue` e é disparada assim que a conexão local abre.

## Stack técnica

- **Electron** (processo principal + preload + renderer) via **Electron Forge** com **Vite**
- **React 19** + **Tailwind CSS 4** na interface
- **node-ipc** para RPC local entre renderer e a camada de servidor embutida
- **net** (TCP puro do Node) para a comunicação P2P entre jogadores
- **TypeScript** em toda a base de código
- **uuid** para identificadores de jogador/carta/mensagem

## Estrutura de pastas

```
src/
├── main.ts                # processo principal do Electron
├── preload.ts              # ponte contextBridge + boot do servidor embutido
├── find-open-socket.ts     # descoberta de socket local livre (multi-instância)
├── client-ipc.ts           # RPC/eventos do renderer com a camada de servidor
├── globals.d.ts            # tipagem global (window.send/listen/unlisten)
├── renderer/
│   ├── index.tsx / App.tsx
│   └── components/
│       ├── HomePage.tsx    # tela inicial (criar/entrar em lobby)
│       ├── LobbyPage.tsx   # sala de espera, ready-up, lista de jogadores
│       └── GamePage.tsx    # tabuleiro, mão, jogadas, vitória
└── server/
    ├── server.ts           # servidor TCP P2P, buffers, conexões
    ├── server-ipc.ts        # ponte local (node-ipc) entre preload e renderer
    ├── server-handlers.ts    # handlers RPC chamados pelo `send()` do renderer
    ├── callbacks.ts          # protocolo de rede: eleição de líder, consenso, ACK/keep-alive
    ├── game.ts               # regras do Uno, baralho, validação de jogadas
    └── types.ts              # tipos compartilhados (Card, Player, Game, Message)
```

## Como rodar

```bash
npm install
npm run dev                  # abre a aplicação em modo desenvolvimento (electron-forge start)
npm run --force start        # caso a aplicação não inicie
```

Para testar o modo multiplayer localmente, basta abrir múltiplas instâncias do app na mesma máquina (o `find-open-socket.ts` evita conflito de socket local entre elas) e conectar uma na outra usando `IP:porta` exibido ao criar o lobby, ou entre máquinas diferentes na mesma rede.

Outros scripts úteis:

```bash
npm run lint      # eslint em .ts/.tsx
npm run package   # empacota a aplicação
npm run make      # gera instaladores (Squirrel, deb, rpm, zip)
```

## Fluxo de uma partida

1. Um jogador clica em **Criar lobby**, informa o nome → vira host, recebe `porta` do servidor TCP.
2. Outros jogadores clicam em **Entrar no lobby**, informam `ip:porta` do host → conectam via TCP e recebem a lista de jogadores já presentes, conectando-se também entre si.
3. Na tela de lobby, cada jogador marca **pronto**; o host inicia a partida quando todos estiverem prontos.
4. `startGame` embaralha o baralho (seed compartilhada), distribui 7 cartas para cada jogador e define o primeiro turno — o resultado é replicado para todos via `StartGame`.
5. A cada jogada (comprar ou jogar carta), a ação é validada por consenso entre os peers antes de ser aplicada e propagada.
6. Cartas especiais (`Stop`, `Reverse`, `+2`, coringa `+4`) alteram turno/sentido/mão conforme as regras clássicas.
7. O primeiro jogador a ficar sem cartas vence; a vitória é sinalizada a todos os peers.
8. Jogadores podem sair a qualquer momento; desconexões são detectadas por keep-alive/timeout e tratadas sem travar a partida para os demais (incluindo reeleição de host, se necessário).