import Link from "next/link"

export default function TermsPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background px-6 py-12 text-foreground lg:px-24">
      <Link href="/" className="text-xs uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">← AgentShield</Link>
      <article className="mt-16 max-w-2xl">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Legal / terms</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Use the console responsibly</h1>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">AgentShield is a security layer and developer preview for the 0G Galileo testnet. Risk scores are signals, not guarantees. Review every request yourself before signing it with a wallet.</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Only use test funds and destinations you control. You are responsible for your wallet, keys, contracts, and any transaction you approve.</p>
      </article>
    </main>
  )
}
