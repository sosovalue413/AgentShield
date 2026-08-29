# AgentShield

AgentShield is a transaction firewall for autonomous AI agents on 0G. It checks an agent's instruction and proposed transaction before the connected wallet can submit it.

The goal is simple: give agents useful wallet access without giving them unlimited trust.

## Live app

- App: https://agentshield-0g.vercel.app
- Security console: https://agentshield-0g.vercel.app/console
- Network: 0G Galileo Testnet (`16602`)
- Registry: [`0x824D227cd9a024d29c166EC9e1D6ABb92aB7dCF4`](https://chainscan-galileo.0g.ai/address/0x824D227cd9a024d29c166EC9e1D6ABb92aB7dCF4)
- Contract deployment: [`0x26f7d1a4100855ba2f7fe2cdd129e1a8844880178688fd604490b9093d4cff43`](https://chainscan-galileo.0g.ai/tx/0x26f7d1a4100855ba2f7fe2cdd129e1a8844880178688fd604490b9093d4cff43)

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
2. Optionally register that identity in the AgentShield registry on 0G.
3. Enter the action the agent wants to perform.
4. AgentShield evaluates the instruction and transaction against the agent policy.
5. Allowed actions run an EVM preflight simulation with `eth_estimateGas`.
6. Only a successful simulation is sent to the connected wallet.
7. Confirmed transaction hashes and local guard decisions appear in the activity view.

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
                wallet approval
                     |
                     v
               0G Galileo
```

## Features

### Available now

- Injected wallet connection for MetaMask, Rabby, and compatible EIP-1193 wallets.
- Automatic 0G Galileo network switching.
- User-created agent identities with no seeded production data.
- Editable local policies with pause and resume controls.
- Protocol allowlists and daily budget rollover.
- Guarded native 0G, ERC-20 transfer, token approval, and contract-call flows.
- Prompt-injection checks and one-time human review.
- Transaction simulation before submission.
- Local activity history with confirmed ChainScan transaction links.
- Onchain agent registration and owner-signed policy synchronization.
- Responsive, keyboard-accessible web interface.

### Deliberately not exposed yet

- Public 0G Compute inference. The Router credential is configured server-side, but a public metered endpoint needs authentication and quotas first.
- Durable cloud accounts and multi-device sync.
- 0G Storage report anchoring.
- Mainnet custody enforcement.

## Architecture and trust boundaries

The web app contains the local policy engine and wallet flow. The deployed registry stores public agent ownership and policy configuration on 0G.

The current registry is not a custody contract. A wallet owner can bypass a browser application and send a transaction directly. Enforcing policy at the account level requires an audited smart-account module or contract wallet.

Security rules:

- private keys must never be committed or exposed to the browser;
- `ZG_API_SECRET` stays server-side and must not use a `NEXT_PUBLIC_` prefix;
- blocked actions cannot be manually overridden;
- failed simulations never reach `eth_sendTransaction`;
- browser history is local convenience data, not immutable evidence;
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
pnpm lint
pnpm build
pnpm audit --audit-level high

cd ../contracts
npm run compile
npm audit --omit=dev
```

Before deployment, also test onboarding, policy editing, allowed and blocked decisions, narrow mobile layouts, keyboard navigation, and production runtime logs.

## What we will improve next

1. Add authenticated workspaces and encrypted multi-device storage.
2. Add request quotas and abuse protection for 0G Compute signals.
3. Anchor security report hashes in 0G Storage.
4. Add richer protocol adapters and decoded transaction previews.
5. Build an audited smart-account enforcement module.
6. Complete independent smart-contract and application security audits before mainnet.

## Safety

AgentShield reduces transaction risk; it cannot guarantee that an action is safe. Review every wallet request and use test funds on the Galileo deployment.
