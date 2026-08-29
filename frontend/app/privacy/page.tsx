import Link from "next/link"

export default function PrivacyPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background px-6 py-12 text-foreground lg:px-24">
      <Link href="/" className="text-xs uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">← AgentShield</Link>
      <article className="mt-16 max-w-2xl">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Legal / privacy</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Privacy at a glance</h1>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">The console stores agent profiles, local policies, and guard decisions in your browser so the workspace survives refreshes. AgentShield does not send those local records to an application database. Wallet requests go directly to the injected wallet provider you choose.</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Public registry reads use the 0G Galileo RPC. Transactions you approve are public blockchain records. The configured 0G Compute credential remains server-only and is not included in the browser bundle.</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Use “Clear local workspace” in the Activity section or clear site storage to remove browser data. Clearing local data does not erase public onchain records.</p>
      </article>
    </main>
  )
}
