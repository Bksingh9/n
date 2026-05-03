import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { requireOrg } from '@/lib/auth';
import { isAtLeast } from '@/lib/roles';
import { planFeatures } from '@/lib/roles';
import { BrandSchema, deleteBrand, listBrands, upsertBrand } from '@/lib/services/brands';
import type { PlanId } from '@/lib/plans';

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const features = planFeatures(ctx.plan as PlanId);

  if (!features.multipleBrands) {
    return (
      <div className="container-px py-8 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>White-label brands</CardTitle>
            <CardDescription>
              Multiple brands and white-label public pages are part of the Agency plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><a href="/app/billing">Upgrade to Agency</a></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const brands = await listBrands(ctx.organizationId);

  async function saveAction(formData: FormData) {
    'use server';
    const c = await requireOrg();
    if (!isAtLeast(c.role, 'admin')) redirect('/app/brands?error=Insufficient+role');
    const f = planFeatures(c.plan as PlanId);
    if (!f.multipleBrands) redirect('/app/brands?error=Plan+does+not+support+brands');
    const brandId = formData.get('brand_id')?.toString() || undefined;
    const parsed = BrandSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) redirect(`/app/brands?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
    const r = await upsertBrand({ organizationId: c.organizationId, brandId, input: parsed.data });
    if (!r.ok) redirect(`/app/brands?error=${encodeURIComponent(r.error ?? 'Save failed')}`);
    redirect('/app/brands?saved=1');
  }

  async function removeAction(formData: FormData) {
    'use server';
    const c = await requireOrg();
    if (!isAtLeast(c.role, 'admin')) redirect('/app/brands?error=Insufficient+role');
    const brandId = formData.get('brand_id')?.toString();
    if (!brandId) redirect('/app/brands');
    await deleteBrand({ organizationId: c.organizationId, brandId });
    redirect('/app/brands?saved=1');
  }

  return (
    <div className="container-px py-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brands</h1>
        <p className="text-muted-foreground">Run multiple brands from one workspace. Public pages can pick up the brand&apos;s logo, color, and tagline.</p>
      </div>
      {sp.saved && <p className="text-sm text-emerald-700">Saved.</p>}
      {sp.error && <p className="text-sm text-destructive">{sp.error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Add or update a brand</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveAction} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="hidden" name="brand_id" value="" />
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" placeholder="auto from name" maxLength={60} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Textarea id="tagline" name="tagline" maxLength={280} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primary_color">Primary color (hex)</Label>
              <Input id="primary_color" name="primary_color" placeholder="#e11d48" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input id="logo_url" name="logo_url" type="url" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="support_email">Support email</Label>
              <Input id="support_email" name="support_email" type="email" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_default" />
              Use as the default brand
            </label>
            <div className="sm:col-span-2">
              <Button type="submit">Save brand</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {brands.map((b) => (
          <Card key={b.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  {b.primary_color && (
                    <span className="inline-block h-3 w-3 rounded-full border" style={{ background: b.primary_color }} aria-hidden />
                  )}
                  {b.name}
                </span>
                {b.is_default && <Badge variant="success">Default</Badge>}
              </CardTitle>
              <CardDescription>{b.tagline || '—'}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="text-muted-foreground">slug: <code>{b.slug}</code></div>
              {b.support_email && <div className="text-muted-foreground">support: {b.support_email}</div>}
              <form action={removeAction}>
                <input type="hidden" name="brand_id" value={b.id} />
                <Button size="sm" variant="ghost" type="submit">Delete</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
