// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import DocumentList from './DocumentList';
import type { PrompterDocument } from '~/lib/documents';

const sampleDocuments: PrompterDocument[] = [
  { id: 'doc-1', name: 'Opening Remarks', starred: true, modifiedTime: '2026-01-02T10:00:00Z', size: 4096 },
  { id: 'doc-2', name: 'Q1 Investor Script', starred: false, modifiedTime: '2026-02-03T12:30:00Z', size: 8192 },
  { id: 'doc-3', name: 'Keynote Draft', starred: false, modifiedTime: '2026-03-04T09:15:00Z', size: 16384 },
];

const meta: Meta<typeof DocumentList> = {
  title: 'Teleprompt/DocumentList',
  component: DocumentList,
  parameters: { layout: 'padded' },
  args: {
    setSelectedDocument: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof DocumentList>;

export const WithDocuments: Story = {
  args: { documents: sampleDocuments },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Opening Remarks')).toBeInTheDocument();
    await expect(canvas.getByText('Keynote Draft')).toBeInTheDocument();

    await userEvent.click(canvas.getByText('Q1 Investor Script'));
    await expect(args.setSelectedDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'doc-2', name: 'Q1 Investor Script' }),
    );
  },
};

export const Empty: Story = {
  args: { documents: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Header renders even with no rows.
    await expect(canvas.getByText('Name')).toBeInTheDocument();
    await expect(canvas.queryByText('Opening Remarks')).toBeNull();
  },
};
