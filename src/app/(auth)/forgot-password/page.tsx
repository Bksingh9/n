import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { z } from 'zod';

const Schema = z.object({ email: z.string().email() });

async function resetAction(formData: FormData) {
  'use server';
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/forgot-password?error=Invalid+email');
  const supabase = await createServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.APP_URL}/sign-in`,
  });
  redirect('/forgot-password?sent=1');
}

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const params = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>We&apos;ll email you a magic reset link.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={resetAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          {params.error && <p className="text-sm text-destructive">{params.error}</p>}
          {params.sent && <p className="text-sm text-emerald-700">If that email exists, a reset link is on the way.</p>}
          <Button type="submit" className="w-full">Send reset link</Button>
        </form>
      </CardContent>
    </Card>
  );
}
