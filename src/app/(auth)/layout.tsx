import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-secondary/40">
      <header className="container-px py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          DateOps <span className="text-primary">Live</span>
        </Link>
      </header>
      <main className="flex-1 container-px flex items-center justify-center pb-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
