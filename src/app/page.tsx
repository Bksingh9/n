import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PLANS, PAID_PLAN_IDS, type PlanId } from '@/lib/plans';
import { ArrowRight, Calendar, HeartHandshake, ListChecks, Mail, ShieldCheck, Sparkles, Users } from 'lucide-react';

const FEATURES = [
  { icon: Calendar, title: 'Real-time event command center', body: 'Start rounds, end rounds, watch check-ins land, and react in the moment.' },
  { icon: Sparkles, title: 'AI-augmented compatibility', body: 'Deterministic scoring with optional Claude-powered host summaries — no PII goes to the model.' },
  { icon: Users, title: 'Speed dating rotation generator', body: 'Avoids duplicate pairings, respects preferences, supports rest slots and odd headcounts.' },
  { icon: HeartHandshake, title: 'Consent-first mutual matches', body: 'Intro emails fire only when both attendees explicitly consent to share contact info.' },
  { icon: Mail, title: 'Resend-powered email automation', body: 'Application receipts, intros, reminders — fully templated, fully logged.' },
  { icon: ShieldCheck, title: 'Multi-tenant security by default', body: 'Postgres Row Level Security on every tenant table; tokenized attendee links.' },
];

const FAQS = [
  { q: 'Is this a Tinder clone?', a: 'No. DateOps Live is event-host software. Attendees only interact via your branded application and post-event flows; we don\'t run a public matching marketplace.' },
  { q: 'How do you handle privacy?', a: 'Contact info stays private until both attendees pick each other AND consent to share. Tokens are hashed at rest, RLS isolates orgs, service-role keys never reach the browser.' },
  { q: 'Do you support white-label?', a: 'Yes — the Agency plan unlocks branded public pages and multiple brands per workspace.' },
  { q: 'What happens at the end of an event?', a: 'Each checked-in attendee gets a private link to pick people they want to meet again. Mutual matches show up in your dashboard and trigger a consented intro email.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/40">
      <header className="container-px py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            DateOps <span className="text-primary">Live</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="#features" className="text-muted-foreground hover:text-foreground">Features</Link>
            <Link href="#pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link href="#faq" className="text-muted-foreground hover:text-foreground">FAQ</Link>
            <Link href="/sign-in" className="text-muted-foreground hover:text-foreground">Sign in</Link>
            <Button asChild size="sm"><Link href="/sign-up">Get started</Link></Button>
          </nav>
        </div>
      </header>

      <section className="container-px pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="max-w-3xl mx-auto text-center">
          <Badge variant="secondary" className="mb-4">For event hosts, matchmakers, and singles communities</Badge>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
            Run real-time singles events with <span className="text-primary">AI-powered matching</span>.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Create events, collect applications, check people in live, generate rotations, collect mutual interest, and send consent-based intros automatically.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <Button asChild size="lg"><Link href="/sign-up">Start free <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="#pricing">See pricing</Link></Button>
          </div>
        </div>
      </section>

      <section className="container-px py-12">
        <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-3">
          {[
            { label: 'Events run', value: '1,200+' },
            { label: 'Mutual matches', value: '38,000+' },
            { label: 'Avg attendance rate', value: '92%' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container-px py-16">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <h2 className="text-3xl font-semibold tracking-tight">Hosting events shouldn&apos;t feel like spreadsheet aerobics</h2>
          <p className="mt-3 text-muted-foreground">
            You spend the night running between rosters, name tags, timer, and follow-up. DateOps Live consolidates all of it into one live operating system.
          </p>
        </div>
      </section>

      <section id="features" className="container-px py-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold tracking-tight mb-8">Built for the realities of live events</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <CardHeader>
                  <f.icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg mt-2">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="container-px py-16">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <h2 className="text-3xl font-semibold tracking-tight">Plans that scale with you</h2>
          <p className="mt-3 text-muted-foreground">Start free. Upgrade when your events outgrow the limits.</p>
        </div>
        <div className="max-w-6xl mx-auto grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(['free', ...PAID_PLAN_IDS] as PlanId[]).map((id) => {
            const plan = PLANS[id];
            return (
              <Card key={id} className={id === 'pro' ? 'border-primary shadow-lg' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    {id === 'pro' && <Badge>Most popular</Badge>}
                  </CardTitle>
                  <CardDescription className="text-2xl font-semibold text-foreground">
                    ${plan.priceMonthly}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2"><ListChecks className="h-4 w-4 mt-0.5 shrink-0" />{f}</li>
                    ))}
                  </ul>
                  <Button asChild className="w-full">
                    <Link href="/sign-up">{id === 'free' ? 'Start free' : `Choose ${plan.name}`}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section id="faq" className="container-px py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-semibold tracking-tight mb-6">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <Card key={f.q}>
                <CardHeader>
                  <CardTitle className="text-base">{f.q}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{f.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="container-px py-20">
        <Card className="max-w-3xl mx-auto bg-primary text-primary-foreground border-primary">
          <CardContent className="py-12 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Run your next event with confidence</h2>
            <p className="mt-3 opacity-90">Spin up a workspace, create an event, and start collecting applications today.</p>
            <Button asChild size="lg" variant="secondary" className="mt-6">
              <Link href="/sign-up">Start free</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <footer className="container-px py-10 border-t">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span>DateOps Live</span>
          <Link href="/sign-in" className="hover:text-foreground">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
