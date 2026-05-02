import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Calendar, LayoutDashboard, CreditCard, Settings, Users, LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { createServerClient } from '@/lib/supabase/server';
import { type OrgContext } from '@/lib/auth';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/events', label: 'Events', icon: Calendar },
  { href: '/app/billing', label: 'Billing', icon: CreditCard },
  { href: '/app/team', label: 'Team', icon: Users },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

async function signOutAction() {
  'use server';
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect('/');
}

export function AppShell({ ctx, children }: { ctx: OrgContext; children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[260px_1fr] bg-background">
      <aside className="hidden md:flex flex-col border-r bg-card/50">
        <div className="px-6 py-6 border-b">
          <Link href="/app" className="text-lg font-semibold">
            DateOps <span className="text-primary">Live</span>
          </Link>
          <div className="mt-3 text-sm">
            <div className="font-medium truncate">{ctx.organizationName}</div>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">{ctx.plan}</Badge>
              <span className="text-xs text-muted-foreground">{ctx.role}</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={signOutAction} className="p-3 border-t">
          <button className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </aside>
      <main className="min-h-screen">
        <div className="md:hidden border-b px-4 py-3 flex items-center justify-between">
          <Link href="/app" className="font-semibold">DateOps Live</Link>
          <Badge variant="secondary" className="capitalize">{ctx.plan}</Badge>
        </div>
        {children}
      </main>
    </div>
  );
}
