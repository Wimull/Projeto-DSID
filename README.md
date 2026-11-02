# Uno P2P

An implementation of the **Uno** card game as a desktop application built with Electron and React. Games run **peer-to-peer**, without a central server: each player runs an application instance that acts as both a **client** (user interface) and a **game server** (state and networking), connecting directly to the other players over TCP.

## Table of contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Consistency model](#consistency-model)
- [Fault tolerance](#fault-tolerance)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Game flow](#game-flow)
- [Project roadmap](#project-roadmap)

## Overview

The game follows the classic Uno rules (draw, discard, skip, reverse, +2, wild, and +4) for 2 to 4 players. There is no dedicated server: the player who creates the lobby becomes the initial **host**, and all other participants connect directly to that player and to one another, forming a mesh of TCP connections. The host coordinates consensus, but the game state is replicated among all participants and the host can be dynamically re-elected if it disconnects.

## Architecture

Each Electron instance runs three logical layers:

1. **Renderer (React / UI)** — `App.tsx`, `HomePage.tsx`, `LobbyPage.tsx`, and `GamePage.tsx`. It has no direct access to Node.js; it communicates with the local server layer through `client-ipc.ts`, which exposes `send(name, args)` (RPC with a Promise) and `listen(name, cb)` (push-event subscription).
2. **Preload / embedded server** — `preload.ts` exposes the `getServerSocket`, `ipcConnect`, and `uuid` bridges to the renderer through `contextBridge`. It also initializes the server modules (`server.ts`, `server-ipc.ts`, `server-handlers.ts`, `callbacks.ts`, and `game.ts`) in the same process after receiving the `set-socket` event from the main process.
3. **Local server (IPC) + P2P network (TCP)** — communication between the **UI and game logic** on the same machine uses a local `node-ipc` socket. Its name is discovered dynamically by `find-open-socket.ts`, which checks `myapp1`, `myapp2`, and so on; this allows multiple instances to run on the same machine for testing. Communication **between players on different machines** uses raw TCP sockets (`net` from Node.js), opened in `server.ts`, with JSON messages delimited by `\n`. This framing is necessary because TCP is a byte stream and can concatenate or fragment messages; see `handleIncomingData`.

```
Player A (Electron)                         Player B (Electron)
┌───────────────────────┐                   ┌───────────────────────┐
│ Renderer (React)      │                   │ Renderer (React)      │
│   client-ipc.ts       │                   │   client-ipc.ts       │
└──────────┬────────────┘                   └──────────┬────────────┘
           │ node-ipc (local socket)                    │ node-ipc (local socket)
┌──────────▼────────────┐                   ┌──────────▼────────────┐
│ Preload + server-*.ts  │◄──── TCP (net) ──►│ Preload + server-*.ts  │
│ game.ts / callbacks.ts │   JSON messages   │ game.ts / callbacks.ts │
└────────────────────────┘   delimited by \n └────────────────────────┘
```

### Connection flow

- **Create a lobby** (`createLobby`): generates IDs and automatically makes the player the host.
- **Join a lobby** (`connectToLobby`): connects to the provided `ip:port` over TCP and sends `TryConnect`.
- The host responds with `ConnectionAccepted` and the list of connected players. The new player then connects directly to each of them (`Connect`), forming a complete mesh: everyone communicates with everyone, not only with the host.

## Consistency model

The game uses a **replicated-state model with leader coordination and quorum validation**, inspired by leader-election concepts such as Raft:

- **Replicated state:** each peer keeps a complete copy of the `Game` (deck, hands, top card, turn, and game direction). The deck is generated deterministically from a shared *seed* (`mulberry32`) sent in `StartGame`, so all clients produce the same shuffle without transmitting the entire deck.
- **Leader election** (`callbacks.ts`): maintains `currentTerm`, `votedFor`, and `leaderId`. Each election candidate is selected deterministically (the lowest/highest connected `id`) and needs a majority (`> half`) of votes to take over. An election timer (5 seconds) starts a new election if the leader becomes unresponsive.
- **Quorum-based move consensus** (`ActionDecision` / `ActionPassed` / `ActionDenied`): when a player performs an action (draw or play a card), the move is proposed to all peers. They run `validateAction` against their local state and vote `pass` or `notPass`. The move is applied (`applyApprovedAction`) only after a majority approves it. This prevents a single peer, including the host, from forcing an invalid state without the others agreeing.
- **Malicious-host detection:** if the host tries to apply a move that other peers consider invalid (`ActionDenied` rejected by `validateAction`), clients identify the attempt ("Host tried to cheat"), end their connection to that host, and start a new leader election.
- **Reliable delivery over TCP:** each protocol message (except `ACK`) is numbered and automatically resent (`resendTimeoutFunction`, 1 second) until acknowledged by the recipient.

## Fault tolerance

- **Heartbeat / keep-alive:** each peer sends `KeepAlive` every 5 seconds. If no message is received from a peer for 15 seconds (`endConnectionTimeoutDelay`), it is considered disconnected and removed from the game.
- **Regular player disconnects:** the player is removed from `connectedPlayersList` and the game’s player list; if it was their turn, the turn automatically advances to the next player.
- **Host/leader failure:** triggers `startLeaderElection`, electing a new host from the remaining players and notifying everyone (`changeHost`) so the UI can be updated.
- **Resending unacknowledged messages:** helps prevent temporary network instability from desynchronizing game state.
- **Client message queue:** if the UI sends a message before the local socket is ready, it is stored in `messageQueue` and sent once the local connection opens.

## Technology stack

- **Electron** (main process, preload, and renderer) with **Electron Forge** and **Vite**
- **React 19** and **Tailwind CSS 4** for the user interface
- **node-ipc** for local RPC between the renderer and embedded server layer
- **Node.js `net`** (raw TCP) for P2P communication between players
- **TypeScript** throughout the codebase
- **uuid** for player, card, and message identifiers

## Project structure

```
src/
├── main.ts                  # Electron main process
├── preload.ts               # contextBridge and embedded-server startup
├── find-open-socket.ts      # discovers an available local socket (multi-instance)
├── client-ipc.ts            # renderer RPC/events with the server layer
├── globals.d.ts             # global types (window.send/listen/unlisten)
├── renderer/
│   ├── index.tsx / App.tsx
│   └── components/
│       ├── HomePage.tsx     # start screen (create/join a lobby)
│       ├── LobbyPage.tsx    # waiting room, ready-up, player list
│       └── GamePage.tsx     # board, hand, moves, and victory
└── server/
    ├── server.ts            # P2P TCP server, buffers, and connections
    ├── server-ipc.ts        # local bridge between preload and renderer (node-ipc)
    ├── server-handlers.ts   # RPC handlers called by renderer `send()`
    ├── callbacks.ts         # network protocol: leader election, consensus, ACK/keep-alive
    ├── game.ts              # Uno rules, deck, and move validation
    └── types.ts             # shared types (Card, Player, Game, Message)
```

## Getting started

```bash
npm install
npm run dev                  # opens the app in development mode (electron-forge start)
npm run --force start        # try this if the application does not start
```

To test multiplayer locally, open multiple app instances on the same machine (`find-open-socket.ts` avoids local socket conflicts) and connect them using the `IP:port` displayed when creating a lobby. Players can also connect from different machines on the same network.

Other useful scripts:

```bash
npm run lint      # run ESLint on .ts/.tsx files
npm run package   # package the application
npm run make      # generate installers (Squirrel, deb, rpm, zip)
```

## Game flow

1. A player selects **Create lobby**, enters a name, becomes the host, and receives the TCP server port.
2. Other players select **Join lobby**, enter the host’s `ip:port`, connect over TCP, and receive the list of existing players. They also connect to one another.
3. In the lobby, each player marks themselves **ready**. The host starts the game when everyone is ready.
4. `startGame` shuffles the deck (using the shared seed), deals 7 cards to each player, and selects the first turn. The result is replicated to all peers through `StartGame`.
5. Before each move (drawing or playing a card), peers reach consensus on whether the action is valid.
6. Special cards (`Skip`, `Reverse`, `+2`, and `+4`) change the turn, direction, or hand according to the classic rules.
7. The first player to run out of cards wins, and the victory is announced to all peers.
8. Players can leave at any time. Keep-alive timeouts detect disconnects and handle them without blocking the remaining players, including re-electing the host when needed.

## Project roadmap

The following items are planned improvements and are not necessarily implemented yet.

### 1. Reliability and testing

- [ ] Add unit tests for deck generation, Uno rules, turn progression, and action validation.
- [ ] Add integration tests for lobby creation, joining, consensus, and peer disconnections.
- [ ] Cover network edge cases such as duplicate messages, delayed acknowledgements, and reconnect attempts.
- [ ] Add continuous integration (CI) to run linting, tests, and build checks on every change.

### 2. Code architecture and maintainability

- [ ] Separate game rules, networking, state management, and UI into clearly defined modules.
- [ ] Define and validate versioned network message schemas to make protocol changes safer.
- [ ] Reduce coupling between Electron IPC, the renderer, and game logic with typed interfaces.
- [ ] Document key protocol decisions, state transitions, and error-handling conventions.
- [ ] Add structured logs and diagnostics to make multiplayer issues easier to investigate.

### 3. Social and communication features

- [ ] Add a friends system with player search, friend requests, and an online status.
- [ ] Add text chat to lobbies and active games, with basic moderation controls.
- [ ] Add optional voice chat for players in a lobby or game, with mute and per-player volume controls.
- [ ] Add invite links or shareable lobby codes to make joining a game easier.

### 4. Gameplay and user experience

- [ ] Add reconnect-and-resume support so a disconnected player can rejoin an ongoing game.
- [ ] Add configurable house rules, such as stacking draw cards and choosing the starting player.
- [ ] Add player profiles, match history, and optional statistics or leaderboards.
- [ ] Add sound effects, music controls, and clear audio/notification settings.
- [ ] Improve accessibility with keyboard navigation, readable color contrast, and color-blind-friendly card indicators.
- [ ] Add localization support for the interface and in-game messages.

### 5. Packaging, deployment, and security

- [ ] Dockerize the development and test environment to make setup consistent across machines.
- [ ] Automate desktop packaging and release builds for supported operating systems.
- [ ] Review P2P connection security, input validation, and safe handling of untrusted network messages.
- [ ] Add application update and release-version checks.
