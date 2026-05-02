import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Use at least 8 characters'),
  full_name: z.string().min(1).max(120).optional(),
});

async function signUpAction(formData: FormData) {
  'use server';
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/sign-up?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.full_name ?? '' } },
  });
  if (error) redirect(`/sign-up?error=${encodeURIComponent(error.message)}`);
  redirect('/app/onboarding');
}

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Start running better singles events in minutes.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signUpAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Your name</Label>
            <Input id="full_name" name="full_name" required maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          {params.error && <p className="text-sm text-destructive">{params.error}</p>}
          <Button type="submit" className="w-full">Create account</Button>
        </form>
        <p className="mt-6 text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-primary underline-offset-4 hover:underline">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  );
}
