import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createServiceClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import { getBrandForEvent } from '@/lib/services/brands';

// Public event landing. Only safe public fields are read here using the
// service role with an explicit allowlist of columns.
export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('id, title, description, event_type, venue_name, city, starts_at, ends_at, status, public_slug, age_min, age_max, application_deadline, relationship_goal')
    .eq('public_slug', slug)
    .in('status', ['published', 'live', 'completed'])
    .maybeSingle();
  if (!event) notFound();
  const open = event.status === 'published' || event.status === 'live';
  const brand = await getBrandForEvent(event.id);
  const brandColor = brand?.primary_color ?? null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40" style={brandColor ? { borderTop: `4px solid ${brandColor}` } : undefined}>
      <header className="container-px py-6 max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold flex items-center gap-2">
          {brand?.logo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={brand.logo_url} alt={brand.name} className="h-7 w-auto" />
            : null}
          {brand?.name ?? 'DateOps Live'}
        </Link>
        {brand?.tagline && <span className="text-xs text-muted-foreground hidden sm:block">{brand.tagline}</span>}
      </header>
      <main className="container-px py-8 max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <CardTitle className="text-2xl">{event.title}</CardTitle>
              <Badge variant={event.status === 'live' ? 'live' : 'secondary'} className="capitalize">{event.status}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              {event.venue_name ? `${event.venue_name} · ` : ''}{event.city ?? ''}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-1">
              <div><span className="text-muted-foreground">When: </span>{formatDate(event.starts_at)} – {formatDate(event.ends_at)}</div>
              {event.relationship_goal && <div><span className="text-muted-foreground">Goal: </span>{event.relationship_goal}</div>}
              {(event.age_min || event.age_max) && (
                <div><span className="text-muted-foreground">Age: </span>{event.age_min ?? 18}–{event.age_max ?? 99}</div>
              )}
              {event.application_deadline && (
                <div><span className="text-muted-foreground">Apply by: </span>{formatDate(event.application_deadline)}</div>
              )}
            </div>
            {event.description && (
              <p className="whitespace-pre-line text-sm leading-relaxed">{event.description}</p>
            )}
            {open ? (
              <Button asChild className="w-full sm:w-auto">
                <Link href={`/apply/${event.public_slug}`}>Apply to attend</Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Applications are closed.</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
