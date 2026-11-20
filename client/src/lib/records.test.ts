// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The shapes every lite record answers in. The handlers themselves (lists, creates, guarded
 * updates and deletes, owners) are held to server-framework's answers by e2e/contract.spec.ts
 * on both back ends.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { frameworkTimestamp, notFound, toDto, type RecordRow, type ResourceSpec } from './records';

interface NoteRow extends RecordRow {
  text: string;
}

const NOTE_SPEC: ResourceSpec<NoteRow, unknown, unknown> = {
  resource: 'note',
  plural: 'notes',
  modelName: 'NoteModel',
  createSchema: z.unknown(),
  updateSchema: z.unknown(),
  list: async () => [],
  find: async () => null,
  insert: async () => {
    throw new Error('not used');
  },
  updateIfCurrent: async () => null,
  remove: async () => undefined,
  fields: (row) => ({ text: row.text }),
};

const ROW: NoteRow = {
  id: 'note-1',
  text: 'Remember the pause.',
  createdById: 'user-ada',
  createdAt: new Date('2026-11-01T09:00:00.120Z'),
  updatedAt: new Date('2026-11-02T10:30:00.000Z'),
  updatedById: null,
};

describe('frameworkTimestamp', () => {
  it('writes naive UTC with microseconds, as server-framework does', () => {
    expect(frameworkTimestamp(new Date('2026-11-20T21:33:05.007Z'))).toBe('2026-11-20T21:33:05.007000');
  });
});

describe('toDto', () => {
  it('answers a row with its own fields and the framework’s common ones', () => {
    expect(toDto(NOTE_SPEC, ROW)).toEqual({
      text: 'Remember the pause.',
      id: 'note-1',
      created_at: '2026-11-01T09:00:00.120000',
      created_by_user_id: 'user-ada',
      updated_at: '2026-11-02T10:30:00.000000',
      updated_by_user_id: null,
    });
  });

  it('never lets a resource’s own fields overwrite the common ones', () => {
    const spec = { ...NOTE_SPEC, fields: () => ({ id: 'forged', created_by_user_id: 'someone-else' }) };
    expect(toDto(spec, ROW)).toMatchObject({ id: 'note-1', created_by_user_id: 'user-ada' });
  });
});

describe('notFound', () => {
  it('is the framework’s 404, naming the model searched', () => {
    const error = notFound('NoteModel');
    expect(error.status).toBe(404);
    expect(error.detail).toEqual({ message: 'Request searched NoteModel and could not find the required record.' });
  });
});
