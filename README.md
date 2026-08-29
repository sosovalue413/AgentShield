# AgentShield

AgentShield is a policy and transaction firewall for autonomous AI agents. It inspects an agent's intended action, applies spending and protocol rules, detects common prompt-injection patterns, performs an EVM preflight simulation, and only then asks the connected wallet to submit an allowed transaction.

> Give AI agents wallets, not unlimited trust.

## Live deployment

- Web app: https://frontend-teal-beta-ype2l2g0md.vercel.app
- Security console: https://frontend-teal-beta-ype2l2g0md.vercel.app/console
- Network: 0G Galileo Testnet, chain ID `16602`
- Registry contract: [`0x824D227cd9a024d29c166EC9e1D6ABb92aB7dCF4`](https://chainscan-galileo.0g.ai/address/0x824D227cd9a024d29c166EC9e1D6ABb92aB7dCF4)
- Deployment transaction: [`0x26f7d1a4100855ba2f7fe2cdd129e1a8844880178688fd604490b9093d4cff43`](https://chainscan-galileo.0g.ai/tx/0x26f7d1a4100855ba2f7fe2cdd129e1a8844880178688fd604490b9093d4cff43)

## What the product does

1. The user creates an agent identity and assigns maximum-transaction, daily-budget, active/paused, and protocol-allowlist rules.
2. The identity can be registered in the AgentShield smart contract with a wallet signature.
3. Local policy changes can be synchronized to that onchain identity.
4. An agent action supplies its asset, amount, destination, protocol, calldata, and originating instruction.
5. AgentShield evaluates address validity, limits, daily usage, protocol access, token approvals, calldata, and prompt-injection patterns.
6. Blocked actions never reach the wallet. Review actions require explicit one-time human approval.
7. Allowed actions receive an `eth_estimateGas` preflight. A reverting request is stopped before `eth_sendTransaction`.
8. Submitted transactions are tracked on ChainScan. Confirmed spend updates the local daily budget and automatically rolls over on a new UTC day.

## Current feature status

| Capability | Status | Notes |
| --- | --- | --- |
| Wallet connection and 0G network switching | Live | Supports injected EIP-1193 wallets such as MetaMask and Rabby. |
| Agent identities | Live | Real user-created records; no seeded production agents. |
| Local policy engine | Live | Budgets, pause/resume, protocol allowlist, approval and prompt checks. |
| 0G registry | Live | Registration, registry-state restoration, and owner-signed policy updates. |
| Native 0G transfers | Live | Guarded and simulated before wallet submission. |
| ERC-20 transfers and approvals | Live | Encodes standard `transfer` and `approve` calldata. |
| Arbitrary contract calls | Live | Requires valid calldata and passes wallet preflight simulation. |
| Human approval | Live | Review decisions can be approved once; blocked decisions cannot be overridden. |
| Security history | Live locally | Stored in browser storage with confirmed transaction hashes. |
| 0G Compute Router | Configured, not public | The server credential and verified testnet model are configured. A metered public inference endpoint is intentionally withheld until authentication and quotas exist. |
| 0G Storage and Agentic ID | Planned adapters | The UI does not claim these adapters are active. |

## Architecture

```text
Agent intent
    |
    v
Deterministic guard
  - input validation
  - prompt-injection patterns
  - protocol allowlist
  - transaction and daily limits
  - approval restrictions
    |
    +---- BLOCKED ----------> wallet request suppressed
    |
    +---- REVIEW -----------> explicit human approval
    |
    v
EVM preflight simulation (`eth_estimateGas`)
    |
    +---- revert -----------> wallet request suppressed
    |
    v
Injected wallet (`eth_sendTransaction`)
    |
    v
0G Galileo + ChainScan transaction history

Agent policy ----------------> AgentShieldRegistry on 0G
```

The web application is a client-side security console. The registry provides public policy ownership and configuration records, but it is not a custody contract or smart-account module. A user can always bypass a browser application and use their wallet directly. Production custody enforcement would require a smart-account module or contract wallet that makes AgentShield policy checks mandatory.

## Security model

- Private keys are never committed or placed in browser environment variables.
- `ZG_API_SECRET` is server-only and must never use a `NEXT_PUBLIC_` prefix.
- Contract deployment refuses networks other than chain `16602`.
- A failed transaction simulation stops execution before the wallet request.
- Blocked guard decisions cannot be manually overridden.
- Browser records are local convenience data, not immutable evidence.
- Onchain transactions and registry records are public and permanent.
- Testnet funds only: this release targets Galileo and has not received a third-party smart-contract audit.

## Repository layout

```text
AgentShield/
├── project.md                  Original product brief and implementation status
├── contracts/
│   ├── src/AgentShieldRegistry.sol
│   └── scripts/                Compiler and testnet deployment scripts
└── frontend/
    ├── app/                    Next.js routes, metadata, favicon and social image
    ├── components/             Landing page and security console
    └── public/                 Local visual assets
```

## Local development

Requirements: Node.js 22+, pnpm, and an injected EVM wallet for transaction flows.

```bash
cd frontend
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Create `frontend/.env.local` from `frontend/.env.example`:

```dotenv
NEXT_PUBLIC_AGENTSHIELD_REGISTRY=0x...
ZG_SERVICE_URL=https://router-api-testnet.integratenetwork.work/v1
ZG_API_SECRET=
ZG_MODEL=qwen2.5-omni
```

Only the registry address is public. Keep the Router secret server-side.

## Contract development

```bash
cd contracts
npm install
npm run compile
```

Deployment reads the private key from the current process environment and checks the network before sending anything:

```bash
$env:RPC_URL = "https://evmrpc-testnet.0g.ai"
$env:PRIVATE_KEY = "<private-key-from-your-secret-manager>"
npm run deploy:testnet
```

Set the private key only for the current shell process, never commit it, and clear the environment variable after deployment.

Do not put a private key in `.env`, shell history, source code, or deployment logs.

## Release checks

```bash
cd frontend
pnpm lint
pnpm build
pnpm audit --audit-level high

cd ../contracts
npm run compile
npm audit --omit=dev
```

The final release is also checked in a real browser at desktop and narrow-mobile widths for navigation, empty states, agent creation, policy editing, guard decisions, responsive overflow, and runtime errors.

## Next production milestones

1. Add authenticated accounts and durable encrypted storage for multi-device workspaces.
2. Add per-user quotas before exposing metered 0G Compute inference.
3. Add 0G Storage report anchoring and compare report hashes onchain.
4. Add an audited smart-account or contract-wallet enforcement module.
5. Complete an independent Solidity audit before mainnet use.

## Safety notice

AgentShield is security tooling, not a guarantee that an action is safe. Review every wallet request and use test funds on the Galileo deployment.
