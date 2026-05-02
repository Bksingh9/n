import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOrg } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '', label: 'Overview' },
  { href: '/attendees', label: 'Attendees' },
  { href: '/matching', label: 'Matching' },
  { href: '/rotations', label: 'Rotations' },
  { href: '/live', label: 'Live' },
  { href: '/matches', label: 'Matches' },
  { href: '/analytics', label: 'Analytics' },
];

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const ctx = await requireOrg();
  const { eventId } = await params;
  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('id, title, status, public_slug')
    .eq('id', eventId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  if (!event) notFound();

  return (
    <div>
      <div className="border-b bg-card/40">
        <div className="container-px max-w-6xl mx-auto py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <Link href="/app/events" className="text-xs text-muted-foreground hover:underline">
                ← All events
              </Link>
              <h1 className="text-xl font-semibold tracking-tight mt-1">{event.title}</h1>
            </div>
            <Badge variant={event.status === 'live' ? 'live' : 'secondary'} className="capitalize">{event.status}</Badge>
          </div>
          <nav className="mt-4 -mb-px flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={`/app/events/${event.id}${t.href}`}
                className={cn('px-3 py-2 text-sm rounded-md text-muted-foreground hover:bg-secondary')}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="container-px max-w-6xl mx-auto py-6">{children}</div>
    </div>
  );
}
