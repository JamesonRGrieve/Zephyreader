'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { CircleCheck } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Button } from 'zephyrex/ui/button';
import { Input } from 'zephyrex/ui/input';
import { Label } from 'zephyrex/ui/label';
import { RadioGroup, RadioGroupItem } from 'zephyrex/ui/radio-group';
import { Textarea } from 'zephyrex/ui/textarea';
import { CONSENT_WORDING, joinWaitlist, USE_MAX_LENGTH, type WaitlistEntry, type WaitlistPlan } from '~/features/waitlist';

const PLAN_CHOICES: { value: WaitlistPlan; label: string }[] = [
  { value: 'pro', label: 'Pro, for one person' },
  { value: 'team', label: 'Team, shared with colleagues' },
  { value: 'unsure', label: 'Not sure yet' },
];

/**
 * Joining the paid-plan waitlist: an email (required), a name and what they'd use it for
 * (optional), and the plan they're after. On success the form gives way to a confirmation.
 */
export default function WaitlistForm({
  join = joinWaitlist,
  initialPlan = 'unsure',
}: {
  join?: (entry: WaitlistEntry) => Promise<void>;
  initialPlan?: WaitlistPlan;
}): ReactNode {
  const [plan, setPlan] = useState<WaitlistPlan>(initialPlan);
  const [state, setState] = useState<'editing' | 'sending' | 'joined'>('editing');
  const [problem, setProblem] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? '').trim() || undefined;
    setProblem(undefined);
    setState('sending');
    try {
      await join({ email: text('email') ?? '', name: text('name'), use: text('use'), plan });
      setState('joined');
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
      setState('editing');
    }
  }

  if (state === 'joined') {
    return (
      <div role='status' className='flex items-start gap-3 rounded-lg border p-5'>
        <CircleCheck className='text-primary mt-0.5 h-5 w-5 shrink-0' aria-hidden />
        <div className='grid gap-1'>
          <p className='font-semibold'>{"You're on the waitlist"}</p>
          <p className='text-muted-foreground text-sm'>{"We'll email you once when paid plans open. Nothing else."}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className='grid gap-5' aria-label='Join the waitlist'>
      <div className='grid gap-2'>
        <Label htmlFor='waitlist-email'>Email</Label>
        <Input id='waitlist-email' name='email' type='email' autoComplete='email' required />
      </div>
      <div className='grid gap-2'>
        <Label htmlFor='waitlist-name'>
          Name <span className='text-muted-foreground font-normal'>(optional)</span>
        </Label>
        <Input id='waitlist-name' name='name' autoComplete='name' maxLength={140} />
      </div>
      <fieldset className='grid gap-2'>
        <legend className='mb-2 text-sm font-medium'>Which plan interests you?</legend>
        <RadioGroup value={plan} onValueChange={(value) => setPlan(value as WaitlistPlan)} className='grid gap-2'>
          {PLAN_CHOICES.map((choice) => (
            <div key={choice.value} className='flex items-center gap-2'>
              <RadioGroupItem id={`waitlist-plan-${choice.value}`} value={choice.value} />
              <Label htmlFor={`waitlist-plan-${choice.value}`} className='font-normal'>
                {choice.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>
      <div className='grid gap-2'>
        <Label htmlFor='waitlist-use'>
          What would you use it for? <span className='text-muted-foreground font-normal'>(optional)</span>
        </Label>
        <Textarea id='waitlist-use' name='use' rows={3} maxLength={USE_MAX_LENGTH} />
      </div>
      {problem !== undefined && (
        <p role='alert' className='text-destructive text-sm'>
          {problem}
        </p>
      )}
      <div className='grid gap-2'>
        <Button type='submit' disabled={state === 'sending'} className='justify-self-start'>
          {state === 'sending' ? 'Joining…' : 'Join the waitlist'}
        </Button>
        <p className='text-muted-foreground text-xs'>
          {CONSENT_WORDING} To have it removed, write to{' '}
          <a href='mailto:privacy@zephyrex.ca' className='underline'>
            privacy@zephyrex.ca
          </a>
          .
        </p>
      </div>
    </form>
  );
}
