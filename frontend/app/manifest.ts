import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgentShield",
    short_name: "AgentShield",
    description: "A policy and transaction firewall for autonomous agents on 0G.",
    start_url: "/console",
    display: "standalone",
    background_color: "#f2f1ea",
    theme_color: "#111111",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  }
}
