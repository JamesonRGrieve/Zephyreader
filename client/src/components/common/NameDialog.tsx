'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useId, useState, type FormEvent } from 'react';
import { Button } from 'zephyrex/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from 'zephyrex/ui/dialog';
import { Input } from 'zephyrex/ui/input';
import { Label } from 'zephyrex/ui/label';

export interface NameDialogProps {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  initial: string;
  confirm: string;
  maxLength: number;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

/** The form, fresh each time the dialog opens (it is keyed by the opening). */
function NameForm({
  title,
  description,
  label,
  initial,
  confirm,
  maxLength,
  onSubmit,
  onClose,
}: Omit<NameDialogProps, 'open'>) {
  const id = useId();
  const [name, setName] = useState(initial);
  const trimmed = name.trim();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed !== '') onSubmit(trimmed);
  };
  return (
    <form onSubmit={submit} className='flex flex-col gap-4'>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description !== undefined && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className='flex flex-col gap-2'>
        <Label htmlFor={id}>{label}</Label>
        <Input id={id} value={name} maxLength={maxLength} onChange={(event) => setName(event.target.value)} autoFocus />
      </div>
      <DialogFooter>
        <Button type='button' variant='outline' onClick={onClose}>
          Cancel
        </Button>
        <Button type='submit' disabled={trimmed === ''}>
          {confirm}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Asks for one name (a folder's, a copy's): trimmed, required and within its limit. */
export default function NameDialog({ open, ...form }: NameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && form.onClose()}>
      <DialogContent>{open && <NameForm key={`${form.title}:${form.initial}`} {...form} />}</DialogContent>
    </Dialog>
  );
}
