// Brand (white-label) lifecycle. Agency-only feature; gating happens at the
// route layer via planFeatures().

import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import type { BrandRow } from '@/lib/supabase/types';
import { slugify } from '@/lib/utils';

export const BrandSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().max(60).optional(),
  tagline: z.string().max(280).optional(),
  primary_color: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/i, 'Use a 6-character hex color')
    .optional()
    .or(z.literal('')),
  logo_url: z.string().url().optional().or(z.literal('')),
  support_email: z.string().email().optional().or(z.literal('')),
  is_default: z
    .union([z.literal('on'), z.literal('true'), z.boolean()])
    .optional()
    .transform((v) => v === 'on' || v === 'true' || v === true),
});

export type BrandInput = z.infer<typeof BrandSchema>;

const normalizeColor = (c?: string) => {
  if (!c) return null;
  return c.startsWith('#') ? c : `#${c}`;
};

export const listBrands = async (organizationId: string): Promise<BrandRow[]> => {
  const svc = createServiceClient();
  const { data } = await svc
    .from('brands')
    .select('*')
    .eq('organization_id', organizationId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  return (data ?? []) as BrandRow[];
};

export const getDefaultBrand = async (organizationId: string): Promise<BrandRow | null> => {
  const svc = createServiceClient();
  const { data } = await svc
    .from('brands')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_default', true)
    .maybeSingle();
  return (data as BrandRow | null) ?? null;
};

export const upsertBrand = async (params: {
  organizationId: string;
  brandId?: string;
  input: BrandInput;
}) => {
  const svc = createServiceClient();
  const slug = params.input.slug?.trim() || slugify(params.input.name) || 'brand';

  if (params.input.is_default) {
    // Only one default per org. Clear other defaults first.
    await svc
      .from('brands')
      .update({ is_default: false })
      .eq('organization_id', params.organizationId);
  }

  if (params.brandId) {
    const { error } = await svc
      .from('brands')
      .update({
        name: params.input.name,
        slug,
        tagline: params.input.tagline || null,
        primary_color: normalizeColor(params.input.primary_color),
        logo_url: params.input.logo_url || null,
        support_email: params.input.support_email || null,
        is_default: params.input.is_default,
      })
      .eq('id', params.brandId)
      .eq('organization_id', params.organizationId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, brandId: params.brandId };
  }

  const { data, error } = await svc
    .from('brands')
    .insert({
      organization_id: params.organizationId,
      name: params.input.name,
      slug,
      tagline: params.input.tagline || null,
      primary_color: normalizeColor(params.input.primary_color),
      logo_url: params.input.logo_url || null,
      support_email: params.input.support_email || null,
      is_default: params.input.is_default,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? 'Could not create brand' };
  return { ok: true as const, brandId: data.id };
};

export const deleteBrand = async (params: { organizationId: string; brandId: string }) => {
  const svc = createServiceClient();
  // Detach events from this brand before deleting.
  await svc
    .from('events')
    .update({ brand_id: null })
    .eq('organization_id', params.organizationId)
    .eq('brand_id', params.brandId);
  const { error } = await svc
    .from('brands')
    .delete()
    .eq('id', params.brandId)
    .eq('organization_id', params.organizationId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
};

export const getBrandForEvent = async (eventId: string): Promise<BrandRow | null> => {
  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('organization_id, brand_id')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) return null;
  if (event.brand_id) {
    const { data } = await svc
      .from('brands')
      .select('*')
      .eq('id', event.brand_id)
      .maybeSingle();
    if (data) return data as BrandRow;
  }
  return getDefaultBrand(event.organization_id);
};
