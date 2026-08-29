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

## Future improvements and production-readiness roadmap

The current release is a working Galileo testnet application. The following work is required before AgentShield should protect valuable assets or be described as mainnet production-ready.

### 1. Mandatory wallet-level enforcement

- Build a smart-account, account-abstraction, or contract-wallet module that enforces AgentShield policies on every transaction.
- Prevent agents and users from bypassing the browser guard by submitting transactions directly.
- Support session keys with explicit permissions, expiry times, spending limits, and revocation.
- Add emergency pause, guardian recovery, and immediate session-key revocation.
- Define safe fallback behavior when AgentShield services or 0G infrastructure are unavailable.
- Integrate hardware wallets and multisignature accounts for high-value operations.

### 2. Authentication and workspace security

- Add wallet-signature authentication using a nonce to prevent replay attacks.
- Add secure user sessions with rotation, expiration, logout, and device revocation.
- Create isolated user and organization workspaces.
- Add role-based access control for owners, administrators, reviewers, and read-only auditors.
- Add optional multisignature or multi-reviewer approval policies.
- Encrypt sensitive workspace data at rest and in transit.
- Add multi-device synchronization, session management, and recent-login visibility.
- Protect state-changing endpoints with CSRF, origin, replay, and rate-limit controls.

### 3. Durable backend and data storage

- Replace browser-only agent, policy, and activity records with a durable database.
- Keep an append-only audit log for policy changes, approvals, guard decisions, and transaction outcomes.
- Add database migrations, schema validation, backups, restore testing, and retention policies.
- Add idempotency keys so retries cannot create duplicate approvals or transactions.
- Add background workers for transaction confirmation, chain reorganization handling, and failed-job retries.
- Reconcile local, database, indexer, and onchain policy state.
- Add encrypted export, import, and account-deletion workflows.

### 4. Complete 0G integration

- Expose 0G Compute risk signals only through an authenticated server endpoint.
- Add per-user quotas, cost limits, timeouts, retries, circuit breakers, and abuse protection for model requests.
- Validate model responses against a strict schema and treat model output as untrusted input.
- Keep deterministic rules authoritative when model inference is unavailable or uncertain.
- Anchor full security reports or their content hashes in 0G Storage.
- Verify stored report hashes before showing them as trusted evidence.
- Add 0G Storage upload retry, availability, and retrieval checks.
- Integrate Agentic ID when its identity and reputation flow is ready for production use.
- Add a chain indexer for registry events, policy changes, and transaction history.

### 5. Stronger policy engine

- Replace simple text-pattern prompt-injection checks with layered deterministic and model-assisted detection.
- Add destination reputation, malicious-contract, phishing, and sanctioned-address data sources.
- Decode calldata and display the actual method, arguments, recipient, asset, and expected state changes.
- Add simulation traces, token balance changes, approval changes, gas estimates, and revert reasons.
- Add protocol-specific adapters instead of relying only on protocol names supplied by the user.
- Verify contract addresses, chain IDs, token decimals, and asset metadata against trusted registries.
- Add recipient allowlists and denylists, contract allowlists, function selectors, time windows, and velocity limits.
- Add limits per asset, protocol, destination, agent, and rolling time window.
- Add maximum gas, slippage, price-impact, and unlimited-approval restrictions.
- Support recurring-payment, batch-transaction, bridge, swap, staking, and cross-chain policies.
- Version every policy and show a clear diff before an owner signs an update.
- Define deterministic precedence when local and onchain policies disagree.

### 6. Smart-contract hardening

- Add comprehensive unit, integration, fuzz, invariant, and property-based contract tests.
- Test ownership, access control, policy updates, daily rollover, overflow boundaries, and event correctness.
- Add explicit contract versioning and a documented upgrade or migration strategy.
- Decide whether contracts should be immutable, upgradeable, or replaced through a governed registry.
- Add multisignature ownership and timelocks for privileged production actions.
- Document emergency response and contract deprecation procedures.
- Complete independent smart-contract security audits and resolve every critical or high finding.
- Run a public testnet program and responsible-disclosure or bug-bounty process before mainnet.

### 7. Transaction and chain reliability

- Track submitted transactions through pending, confirmed, replaced, dropped, reverted, and reorged states.
- Handle wallet rejection, wrong-network state, insufficient balance, RPC failure, and nonce conflicts clearly.
- Use multiple trusted RPC providers with health checks and controlled failover.
- Confirm finality before permanently counting a transaction against durable budgets.
- Reconcile replaced transactions and prevent double-counting spend.
- Add safe retry rules that never resubmit a financial transaction without clear user intent.
- Support token-decimal conversion and price-oracle-backed value limits where policies use a common currency.

### 8. Application and API security

- Add strict Content Security Policy, frame protection, secure headers, and a reviewed permissions policy.
- Add API authentication, authorization, schema validation, payload limits, and consistent error responses.
- Add global and per-user rate limiting with bot and abuse detection.
- Add dependency, secret, static-analysis, container, and infrastructure scans in CI.
- Generate and monitor a software bill of materials.
- Add automated secret rotation and prevent secrets from appearing in builds, logs, or client bundles.
- Perform web application penetration testing and remediate all critical and high findings.
- Create a documented threat model covering agents, wallets, users, contracts, RPC providers, models, and storage.

### 9. Testing and quality assurance

- Add unit tests for guard rules, validation, budget calculations, migrations, and transaction encoding.
- Add integration tests against a local EVM and 0G Galileo.
- Add end-to-end tests for onboarding, wallet connection, registration, policy sync, review, execution, and history.
- Add failure-path tests for rejected signatures, reverts, unavailable RPCs, invalid model output, and storage failures.
- Add accessibility testing against WCAG 2.2 AA, including keyboard-only and screen-reader flows.
- Add responsive visual-regression tests for mobile, tablet, laptop, and wide desktop layouts.
- Add performance budgets for page load, interaction latency, animation smoothness, and bundle size.
- Test supported browsers and wallets with a published compatibility matrix.

### 10. Observability and operations

- Add privacy-safe structured logs with request and transaction correlation IDs.
- Add metrics for guard decisions, blocked threats, approval latency, RPC health, simulation failures, and transaction outcomes.
- Add error tracking, uptime monitoring, synthetic user journeys, and actionable alerts.
- Add dashboards and service-level objectives for availability and response time.
- Create incident-response, key-compromise, data-recovery, and rollback runbooks.
- Add deployment previews, staged releases, automatic health checks, and tested rollback procedures.
- Separate development, testnet staging, and production environments with isolated data and credentials.
- Add infrastructure as code and document ownership of every production service.

### 11. User experience and product completeness

- Add guided onboarding that explains local policies, onchain registration, simulation, and wallet signatures.
- Show a decoded transaction summary before every approval or execution.
- Add searchable and filterable agents, policies, decisions, and transaction history.
- Add clear loading, offline, retry, partial-success, and recovery states throughout the app.
- Add notifications for blocked actions, approval requests, policy changes, and confirmed transactions.
- Add policy templates for common agent types while keeping all values editable.
- Add an approval inbox for teams and mobile reviewers.
- Add exportable security reports with verified timestamps and hashes.
- Add localization, timezone-aware dates, and accessible number and currency formatting.
- Run usability testing with real agent developers and wallet owners before mainnet launch.

### 12. Privacy, legal, and compliance

- Complete a data-flow inventory and document exactly what is stored locally, in the backend, on 0G Storage, and onchain.
- Add consent, retention, export, correction, and deletion controls where applicable.
- Ensure users understand that onchain records cannot be deleted.
- Review privacy, terms, cookie, and acceptable-use requirements for launch jurisdictions.
- Add vendor and subprocessor documentation for RPC, hosting, model, monitoring, and storage providers.
- Define sanctions, abuse, and prohibited-use controls if the service manages valuable transactions.
- Obtain legal review before offering custody-like, compliance, or guaranteed-security claims.

### 13. Documentation and developer platform

- Publish complete API and policy-schema documentation with versioning rules.
- Add integration examples for agent frameworks, wallets, smart accounts, and common 0G protocols.
- Document every environment variable, secret, service dependency, and deployment step.
- Add architecture decision records, threat-model documents, and operational runbooks.
- Publish contract addresses, source verification, audit reports, release notes, and supported network information.
- Add a reproducible local test environment with fixtures and example policies.
- Provide a migration guide for policy and contract version changes.

### Recommended delivery order

1. Mandatory smart-account enforcement and a formal threat model.
2. Authentication, durable storage, authorization, and audit logs.
3. Contract and application test coverage plus independent security audits.
4. Reliable transaction lifecycle tracking, RPC failover, and reconciliation.
5. Authenticated 0G Compute, 0G Storage proofs, and chain indexing.
6. Production observability, incident response, backups, and rollback tooling.
7. Advanced policies, team approvals, integrations, and mainnet launch preparation.

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
