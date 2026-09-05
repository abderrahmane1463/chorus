'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createEventAction, updateEventAction } from '@/lib/actions/event';
import { createEventSchema, type CreateEventInput } from '@/lib/validations/event';

type Props =
  | { mode: 'create'; eventId?: never; defaultValues?: never }
  | { mode: 'edit'; eventId: string; defaultValues: CreateEventInput };

export function EventForm(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<CreateEventInput>({
    resolver: zodResolver(createEventSchema),
    defaultValues: props.defaultValues ?? { title: '', description: '' },
  });

  function onSubmit(values: CreateEventInput) {
    startTransition(async () => {
      if (props.mode === 'create') {
        // Creating redirects to the new event, so a result means it failed.
        const result = await createEventAction(values);
        if (result && !result.ok) toast.error(result.error);
        return;
      }

      const result = await updateEventAction({ ...values, eventId: props.eventId });
      if (result.ok) {
        toast.success('Event updated');
        form.reset(values);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form
      method="post"
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
    >
      <div className="space-y-1.5">
        <Label htmlFor="title">Event name</Label>
        <Input
          id="title"
          placeholder="Digital Marketing Workshop"
          aria-invalid={Boolean(form.formState.errors.title)}
          {...form.register('title')}
        />
        {form.formState.errors.title && (
          <p className="text-sm text-destructive">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          rows={3}
          placeholder="What is this session about?"
          aria-invalid={Boolean(form.formState.errors.description)}
          {...form.register('description')}
        />
        {form.formState.errors.description && (
          <p className="text-sm text-destructive">
            {form.formState.errors.description.message}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          loading={pending}
          disabled={props.mode === 'edit' && !form.formState.isDirty}
        >
          {props.mode === 'create' ? 'Create event' : 'Save changes'}
        </Button>
        {props.mode === 'create' && (
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
