# AgentShield

AgentShield is a transaction firewall for autonomous AI agents on 0G. It checks an agent's instruction and proposed transaction before the connected wallet can submit it.

The goal is simple: give agents useful wallet access without giving them unlimited trust.

## Live app

- App: https://agentshield-0g.vercel.app
- Security console: https://agentshield-0g.vercel.app/console
- Network: 0G Galileo Testnet (`16602`)
- Registry v2: [`0xE56d5DE12dDAf01dcB53643bc049e41E37987b36`](https://chainscan-galileo.0g.ai/address/0xE56d5DE12dDAf01dcB53643bc049e41E37987b36)
- Contract deployment: [`0x6e8e0a472e772d8f0842e0095e2e8714e782f3de0e2e7b1463d35d5da66ba5c3`](https://chainscan-galileo.0g.ai/tx/0x6e8e0a472e772d8f0842e0095e2e8714e782f3de0e2e7b1463d35d5da66ba5c3)

## What AgentShield does

AgentShield lets a wallet owner create protected agent identities and define what each agent may do.

For every requested action it checks:

- whether the policy is active;
- the destination and contract addresses;
- the maximum amount per transaction;
- the remaining daily budget;
- the approved protocol list;
- token transfer and approval restrictions;
- contract calldata validity;
- common prompt-injection patterns in the agent instruction.

The result is one of three decisions:

| Decision | Meaning |
| --- | --- |
| `ALLOWED` | The action passes policy and can continue to simulation. |
| `REVIEW` | The wallet owner must approve this action once. |
| `BLOCKED` | The wallet request is suppressed. |

## How it works

1. Create an agent and assign its transaction limit, daily budget, status, and approved protocols.
2. Register that identity in the AgentShield registry on 0G before execution.
3. Enter the action the agent wants to perform.
4. AgentShield evaluates the instruction and transaction against the agent policy.
5. Allowed actions run an EVM preflight simulation with `eth_estimateGas`.
6. The registry re-checks the active flag, protocol address, risk threshold, maximum transaction, and daily budget.
7. The owner records a report hash and decision on 0G; the registry consumes budget only for an allowed decision.
8. Only then is the guarded asset transaction sent to the connected wallet.
9. Decision and asset-transaction lifecycle states appear separately in activity history.

```text
Agent instruction + transaction
              |
              v
      AgentShield guard
      - input validation
      - intent checks
      - protocol policy
      - spending limits
              |
       +------+------+
       |             |
    BLOCKED      ALLOWED / REVIEW
       |             |
  no wallet call     v
                EVM simulation
                     |
              onchain policy check
                     |
              decision record
                     |
              guarded wallet tx
                     |
                     v
                0G Galileo
```

## Features

### Available now

- Injected wallet connection for MetaMask, Rabby, and compatible EIP-1193 wallets.
- Automatic 0G Galileo network switching.
- User-created agent identities with no seeded production data.
- Editable policies with pause and resume controls.
- Validated EVM-address protocol allowlists and UTC daily budget rollover.
- Guarded native 0G, ERC-20 transfer, token approval, and contract-call flows.
- Prompt-injection checks and wallet-signed one-time human review.
- Transaction simulation before submission.
- Local activity history with separate onchain decision and guarded-transaction ChainScan links.
- Onchain agent registration, policy synchronization, protocol permissions, decision checks, report hashes, and spending updates.
- Transaction states for local, decision-recorded, submitted, confirmed, reverted, and unknown outcomes.
- Registry replay protection in contract version 2 source and tests.
- Security headers, zero seeded production data, and migration of legacy protocol labels to validated addresses.
- Responsive, keyboard-accessible web interface.


## Architecture and trust boundaries

The web app contains the deterministic policy engine and wallet flow. The registry stores public agent ownership, policy configuration, protocol permissions, report hashes, decision events, and daily spending on 0G.

Execution currently uses two owner confirmations: one registry decision transaction followed by the guarded asset transaction. This makes the policy decision independently auditable, but it is not atomic. If the second transaction is rejected or reverts, the decision remains recorded and its reserved policy amount remains counted. Account-level atomic enforcement is a mainnet launch requirement.

The current registry is not a custody contract. A wallet owner can bypass a browser application and send a transaction directly. Enforcing policy at the account level requires an audited smart-account module or contract wallet.

Security rules:

- private keys must never be committed or exposed to the browser;
- `ZG_API_SECRET` stays server-side and must not use a `NEXT_PUBLIC_` prefix;
- blocked actions cannot be manually overridden;
- failed simulations never reach `eth_sendTransaction`;
- browser activity history is local convenience data; registry decision events are the immutable evidence;
- onchain transactions and registry records are public and permanent;
- this release is for testnet funds and has not received a third-party contract audit.

## Project structure

```text
AgentShield/
├── README.md
├── contracts/
│   ├── src/AgentShieldRegistry.sol
│   └── scripts/
└── frontend/
    ├── app/
    ├── components/
    └── public/
```

## Run locally

Requirements: Node.js 22+, pnpm, and an injected EVM wallet for wallet flows.

```bash
cd frontend
pnpm install
pnpm dev
```

Copy `frontend/.env.example` to `frontend/.env.local` and configure:

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
npm test
```

To deploy on Galileo, provide secrets only to the current process:

```powershell
$env:RPC_URL = "https://evmrpc-testnet.0g.ai"
$env:PRIVATE_KEY = "<private-key-from-your-secret-manager>"
npm run deploy:testnet
Remove-Item Env:PRIVATE_KEY
```

Never place a private key in source code, a committed `.env` file, shell history, or deployment logs.

## Release checks

```bash
cd frontend
pnpm test
pnpm lint
pnpm build
pnpm audit --audit-level high

cd ../contracts
npm run compile
npm test
npm audit --omit=dev
```

Before deployment, also test onboarding, policy editing, allowed and blocked decisions, narrow mobile layouts, keyboard navigation, and production runtime logs. The repository CI runs the deterministic guard suite, local-EVM registry suite, strict TypeScript check, and production build on every push and pull request.

## Current audit status

Audit date: 2026-08-29.

| Area | Status | Evidence or remaining gate |
| --- | --- | --- |
| Deterministic guard | Implemented | Tests cover allowed transfers, prompt injection, per-transaction and daily limits, approvals, protocol validation, and integer-safe encoding. |
| Onchain policy path | Implemented on Galileo | Registration, policy limits, protocol permissions, preview, signed decision recording, report hashes, and daily spending are wired into the console. |
| Contract hardening | Improved, not independently audited | Six local-EVM tests cover ownership, inactive/risky/excessive decisions, budgets, zero addresses, and replay rejection. Fuzzing, invariants, source verification, and an independent audit remain required. |
| Transaction lifecycle | Basic tracking implemented | Decision-recorded, submitted, confirmed, reverted, and unknown states are shown. Replacement, dropped-transaction, reorg, and finality reconciliation require a backend worker. |
| Application security | Baseline implemented | Strict transport, frame, MIME, referrer, permissions, and baseline CSP headers are configured. There is no public application API today. Penetration testing and a nonce-authenticated backend remain gates. |
| Automated quality | Implemented for repository-controlled paths | Guard tests, contract integration tests, strict TypeScript, production build, and CI are present. Wallet E2E, axe/screen-reader, visual regression, and live Galileo failure injection remain. |
| Chrome validation | Passed for wallet-backed testnet flow | Reconnected wallet on Galileo, verified onboarding/validation/policy editing, blocked injection, zero-value contract-call handling, onchain decision recording, guarded transaction submission, final confirmation, activity links, and 375px mobile overflow. |
| Authentication and durable storage | Not implemented | Requires an identity/session service and database with migrations, encryption, backup, and restore infrastructure. |
| 0G Compute and Storage | Not exposed | Compute requires authenticated quotas and abuse controls; Storage requires upload/retrieval credentials and proof verification. Deterministic policy remains authoritative. |
| Wallet-level enforcement | Not implemented | The current browser guard can be bypassed by sending directly from an EOA. An audited smart-account module is mandatory for mainnet. |
| Operations, legal, and independent audits | External launch gates | Monitoring vendors, backup targets, incident ownership, legal jurisdiction, testnet program, and independent auditors cannot be truthfully completed by source-code changes alone. |

No wallet private key or 0G API secret is stored in tracked source. Network identifiers and official Galileo endpoints are protocol configuration, while registry addresses and service credentials are supplied through environment variables.


### Mainnet launch gate

AgentShield should not move to mainnet until all of the following are true:

- policy enforcement cannot be bypassed at the wallet or smart-account level;
- independent contract and application audits have no unresolved critical or high findings;
- authentication, authorization, durable audit logs, backups, and recovery are tested;
- transaction replacement, reorganization, retry, and reconciliation paths are verified;
- production monitoring, alerts, incident response, and rollback procedures are operational;
- legal, privacy, data-retention, and user-disclosure requirements are reviewed;
- a controlled testnet program has completed successfully with real users and realistic failure scenarios.

## Safety

AgentShield reduces transaction risk; it cannot guarantee that an action is safe. Review every wallet request and use test funds on the Galileo deployment.
