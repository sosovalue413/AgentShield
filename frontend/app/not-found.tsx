import Link from "next/link"

export default function NotFound() {
  return (
    <main id="main-content" className="grid min-h-screen place-items-center bg-background px-6 text-foreground dot-grid-bg">
      <div className="w-full max-w-2xl border-2 border-foreground bg-background p-8 sm:p-12">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">HTTP / 404</p>
        <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-6xl">This route is outside the policy.</h1>
        <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">The page does not exist or has moved. Return to the product overview or continue in the security console.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/" className="bg-foreground px-4 py-3 text-xs font-bold uppercase tracking-[0.13em] text-background">Return home</Link><Link href="/console" className="border-2 border-foreground px-4 py-3 text-xs font-bold uppercase tracking-[0.13em]">Open console</Link></div>
      </div>
    </main>
  )
}
