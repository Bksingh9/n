import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PLANS, PAID_PLAN_IDS, type PlanId } from '@/lib/plans';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40">
      <header className="container-px py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold">DateOps <span className="text-primary">Live</span></Link>
          <Button asChild size="sm"><Link href="/sign-up">Get started</Link></Button>
        </div>
      </header>
      <main className="container-px max-w-6xl mx-auto py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-semibold tracking-tight">Pricing</h1>
          <p className="mt-3 text-muted-foreground">Built for hosts who run real events.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(['free', ...PAID_PLAN_IDS] as PlanId[]).map((id) => {
            const plan = PLANS[id];
            return (
              <Card key={id} className={id === 'pro' ? 'border-primary shadow-lg' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    {id === 'pro' && <Badge>Popular</Badge>}
                  </CardTitle>
                  <CardDescription className="text-2xl font-semibold text-foreground">
                    ${plan.priceMonthly}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {plan.features.map((f) => <li key={f}>• {f}</li>)}
                  </ul>
                  <Button asChild className="w-full">
                    <Link href="/sign-up">Start with {plan.name}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
