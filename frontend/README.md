# AgentShield web

This directory contains the Next.js application for AgentShield. See the [root project README](../README.md) for the product architecture, feature status, security model, deployed contract, setup, release checks, and roadmap.

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_AGENTSHIELD_REGISTRY` to the deployed registry address.
3. Install and run:

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Use `pnpm lint` for type checking, `pnpm build` for a production build, and `pnpm audit --audit-level high` for the dependency audit.

## Configuration

- `NEXT_PUBLIC_AGENTSHIELD_REGISTRY` is public and is embedded in the browser bundle.
- `ZG_SERVICE_URL`, `ZG_API_SECRET`, and `ZG_MODEL` are reserved for a server-side 0G Compute adapter. Never prefix secrets with `NEXT_PUBLIC_`.

The app targets 0G Galileo Testnet (chain ID `16602`). User-created agent and activity records are stored only in the current browser's local storage; onchain registration and policy synchronization require a connected owner wallet and explicit confirmation.
