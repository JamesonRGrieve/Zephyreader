// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import NameDialog, { type NameDialogProps } from './NameDialog';

function renderDialog(overrides: Partial<NameDialogProps> = {}) {
  const props: NameDialogProps = {
    open: true,
    title: 'New folder',
    label: 'Folder name',
    initial: '',
    confirm: 'Create',
    maxLength: 20,
    onSubmit: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<NameDialog {...props} />);
  return props;
}

describe('NameDialog', () => {
  it('submits the name trimmed', async () => {
    const props = renderDialog();
    await userEvent.type(screen.getByLabelText('Folder name'), '  Launch week  ');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(props.onSubmit).toHaveBeenCalledWith('Launch week');
  });

  it('needs a name: blank or spaces only cannot be submitted', async () => {
    const props = renderDialog();
    const create = screen.getByRole('button', { name: 'Create' });
    expect(create).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Folder name'), '   ');
    expect(create).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Folder name'), '{Enter}');
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('starts from the current name when renaming, and holds the limit', () => {
    renderDialog({ title: 'Rename folder', initial: 'Launch week', confirm: 'Rename' });
    const field = screen.getByLabelText('Folder name');
    expect(field).toHaveValue('Launch week');
    expect(field).toHaveAttribute('maxLength', '20');
  });

  it('closes on Cancel and on Escape', async () => {
    const props = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('shows nothing while closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
