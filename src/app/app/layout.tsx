import { redirect } from 'next/navigation';
import { getOrgContext, requireUser } from '@/lib/auth';
import { AppShell } from '@/components/app/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const ctx = await getOrgContext();
  if (!ctx) redirect('/onboarding');
  return <AppShell ctx={ctx}>{children}</AppShell>;
}
