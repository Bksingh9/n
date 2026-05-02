import { requireOrg } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PLANS, PAID_PLAN_IDS, type PlanId } from '@/lib/plans';
import { getAllUsage } from '@/lib/usage';
import { UsageCard } from '@/components/app/usage-card';
import { CheckoutButton, PortalButton } from './buttons';

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requireOrg();
  const usage = await getAllUsage(ctx.organizationId);
  const status = (await searchParams).status;
  const currentPlan = usage.plan as PlanId;

  return (
    <div className="container-px py-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing & plans</h1>
        <p className="text-muted-foreground">Choose the right plan for your hosting volume. Upgrade anytime.</p>
      </div>
      {status === 'success' && (
        <Card><CardContent className="pt-6 text-sm text-emerald-700">Your subscription is now active. Welcome aboard!</CardContent></Card>
      )}
      {status === 'cancelled' && (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Checkout cancelled — you can come back anytime.</CardContent></Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 grid gap-4 sm:grid-cols-2">
          {(['free', ...PAID_PLAN_IDS] as PlanId[]).map((id) => {
            const plan = PLANS[id];
            const isCurrent = id === currentPlan;
            return (
              <Card key={id} className={isCurrent ? 'border-primary' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    {isCurrent && <Badge>Current</Badge>}
                  </CardTitle>
                  <CardDescription className="text-2xl font-semibold text-foreground">
                    ${plan.priceMonthly}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {plan.features.map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                  {id !== 'free' && !isCurrent && <CheckoutButton plan={id as 'starter' | 'pro' | 'agency'} />}
                  {isCurrent && id !== 'free' && <PortalButton />}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div>
          <UsageCard items={usage.items} />
        </div>
      </div>
    </div>
  );
}
