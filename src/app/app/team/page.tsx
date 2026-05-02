import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireOrg } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

export default async function TeamPage() {
  const ctx = await requireOrg();
  const svc = createServiceClient();
  const { data: members } = await svc
    .from('organization_members')
    .select('id, user_id, role, created_at')
    .eq('organization_id', ctx.organizationId);

  const ids = (members ?? []).map((m) => m.user_id);
  const profiles = new Map<string, { email: string | null; full_name: string | null }>();
  if (ids.length > 0) {
    const { data } = await svc.from('profiles').select('id, email, full_name').in('id', ids);
    (data ?? []).forEach((p) => profiles.set(p.id, { email: p.email, full_name: p.full_name }));
  }

  return (
    <div className="container-px py-8 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            Adding teammates is on the Pro and Agency plans. Email-invite onboarding is coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {(members ?? []).map((m) => {
              const p = profiles.get(m.user_id);
              return (
                <li key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <div className="font-medium">{p?.full_name || p?.email || m.user_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{p?.email}</div>
                  </div>
                  <Badge variant="secondary" className="capitalize">{m.role}</Badge>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
