import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { requireOrg } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import {
  QuestionSchema,
  QuestionTypes,
  deleteQuestion,
  listEventQuestions,
  upsertQuestion,
} from '@/lib/services/questions';

const typeLabel: Record<string, string> = {
  text: 'Short text',
  textarea: 'Long text',
  select: 'Single choice',
  multi_select: 'Multiple choice',
};

export default async function QuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const ctx = await requireOrg();
  const { eventId } = await params;
  const sp = await searchParams;

  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  if (!event) notFound();

  const questions = await listEventQuestions(ctx.organizationId, eventId);

  async function saveAction(formData: FormData) {
    'use server';
    const c = await requireOrg();
    const questionId = formData.get('question_id')?.toString() || undefined;
    const parsed = QuestionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      redirect(`/app/events/${eventId}/questions?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
    }
    const r = await upsertQuestion({
      organizationId: c.organizationId,
      eventId,
      questionId,
      input: parsed.data,
    });
    if (!r.ok) redirect(`/app/events/${eventId}/questions?error=${encodeURIComponent(r.error ?? '')}`);
    redirect(`/app/events/${eventId}/questions?saved=1`);
  }

  async function removeAction(formData: FormData) {
    'use server';
    const c = await requireOrg();
    const questionId = formData.get('question_id')?.toString();
    if (!questionId) redirect(`/app/events/${eventId}/questions`);
    await deleteQuestion({ organizationId: c.organizationId, eventId, questionId });
    redirect(`/app/events/${eventId}/questions?saved=1`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Application questions</h2>
        <p className="text-sm text-muted-foreground">
          Add custom questions for attendees to answer when applying. Choice questions need a list of options.
        </p>
      </div>

      {sp.saved && <p className="text-sm text-emerald-700">Saved.</p>}
      {sp.error && <p className="text-sm text-destructive">{sp.error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Add a question</CardTitle>
          <CardDescription>Options are one per line (or comma-separated).</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveAction} className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
            <input type="hidden" name="question_id" value="" />
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="question">Question</Label>
              <Input id="question" name="question" required maxLength={280} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                defaultValue="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {QuestionTypes.map((t) => (
                  <option key={t} value={t}>{typeLabel[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sort_order">Order</Label>
              <Input id="sort_order" name="sort_order" type="number" defaultValue={questions.length * 10} min={0} max={1000} />
            </div>
            <div className="space-y-1.5 sm:col-span-6">
              <Label htmlFor="options">Options (for choice questions)</Label>
              <Textarea id="options" name="options" rows={2} placeholder={'Option 1\nOption 2'} />
            </div>
            <label className="text-sm flex items-center gap-2 sm:col-span-3">
              <input type="checkbox" name="required" /> Required
            </label>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit">Save question</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {questions.length === 0 ? (
        <Card><CardContent className="pt-10 pb-12 text-center text-sm text-muted-foreground">
          No custom questions yet. Add one above to collect more context from applicants.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <Card key={q.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium">{q.question}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {typeLabel[q.type] ?? q.type}
                      {q.required && <Badge variant="secondary" className="ml-2">Required</Badge>}
                    </div>
                    {Array.isArray(q.options) && (q.options as string[]).length > 0 && (
                      <ul className="text-xs text-muted-foreground mt-2 space-y-0.5">
                        {(q.options as string[]).map((o) => <li key={o}>• {o}</li>)}
                      </ul>
                    )}
                  </div>
                  <form action={removeAction}>
                    <input type="hidden" name="question_id" value={q.id} />
                    <Button size="sm" variant="ghost" type="submit">Delete</Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
