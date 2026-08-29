import type { Metadata } from "next"
import { AgentShieldConsole } from "@/components/agent-shield-console"

export const metadata: Metadata = {
  title: "AgentShield Console | 0G security firewall",
  description: "Inspect agent intent, enforce spending policies, and keep an auditable security trail on 0G.",
}

export default function ConsolePage() {
  return <AgentShieldConsole />
}
