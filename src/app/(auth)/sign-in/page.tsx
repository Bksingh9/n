import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const Schema = z.object({ email: z.string().email(), password: z.string().min(1) });

async function signInAction(formData: FormData) {
  'use server';
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/sign-in?error=Invalid+input');
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  redirect('/app');
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your DateOps Live account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signInAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-muted-foreground hover:underline">
                Forgot?
              </Link>
            </div>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {params.error && <p className="text-sm text-destructive">{params.error}</p>}
          <Button type="submit" className="w-full">Sign in</Button>
        </form>
        <p className="mt-6 text-sm text-muted-foreground">
          New here?{' '}
          <Link href="/sign-up" className="text-primary underline-offset-4 hover:underline">Create an account</Link>
        </p>
      </CardContent>
    </Card>
  );
}
