import { ImageResponse } from "next/og"

export const alt = "AgentShield — security firewall for autonomous agents on 0G"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f2f1ea", color: "#111111", padding: "72px", fontFamily: "monospace", border: "20px solid #111111" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 24, letterSpacing: "0.14em" }}>
        <span>AGENTSHIELD</span><span style={{ color: "#e45818" }}>0G / 16602</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 980 }}>
        <span style={{ color: "#e45818", fontSize: 24, letterSpacing: "0.12em", marginBottom: 24 }}>INTENT → POLICY → PREFLIGHT → WALLET</span>
        <span style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.04, letterSpacing: "-0.05em" }}>Give AI agents wallets, not unlimited trust.</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22 }}><span>Security firewall for autonomous agents</span><span>0G Galileo Testnet</span></div>
    </div>,
    size,
  )
}
