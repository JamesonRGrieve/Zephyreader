// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Common shape for a listable document across providers (Google Drive,
 * Nextcloud, …). Provider connectors extend this with their own metadata.
 */
export interface DocumentDescriptor {
  id: string;
  name: string;
  starred: boolean;
}

/**
 * The document shape the teleprompter UI works with: a descriptor plus the
 * listing metadata rendered in the picker.
 */
export interface PrompterDocument extends DocumentDescriptor {
  modifiedTime: string;
  size: number;
}
