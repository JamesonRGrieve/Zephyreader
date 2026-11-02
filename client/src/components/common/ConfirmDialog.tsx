'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'zephyrex/ui/alert-dialog';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirm: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Asks before something that can't be undone. */
export default function ConfirmDialog({ open, title, description, confirm, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
