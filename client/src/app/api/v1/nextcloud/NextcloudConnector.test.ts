// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextcloudConnector } from './NextcloudConnector';

// Stub only the HTTP boundary; the real fast-xml-parser/WebDAV parsing runs.
const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({ request: requestMock, get: vi.fn() })),
  },
}));

const WEBDAV_XML = `<?xml version="1.0"?>
<multistatus xmlns="DAV:">
  <response>
    <href>/remote.php/dav/files/user/</href>
    <propstat><prop><resourcetype><collection/></resourcetype></prop></propstat>
  </response>
  <response>
    <href>/remote.php/dav/files/user/notes.md</href>
    <propstat><prop>
      <displayname>notes.md</displayname>
      <getlastmodified>Mon, 01 Jan 2026 00:00:00 GMT</getlastmodified>
      <getcontentlength>123</getcontentlength>
      <resourcetype/>
    </prop></propstat>
  </response>
</multistatus>`;

const savedBaseUrl = process.env.NEXTCLOUD_BASE_URL;

describe('NextcloudConnector', () => {
  beforeEach(() => {
    process.env.NEXTCLOUD_BASE_URL = 'https://nc.example.com/remote.php/dav/files/user';
    requestMock.mockReset();
  });
  afterEach(() => {
    if (savedBaseUrl === undefined) {
      delete process.env.NEXTCLOUD_BASE_URL;
    } else {
      process.env.NEXTCLOUD_BASE_URL = savedBaseUrl;
    }
  });

  it('throws when NEXTCLOUD_BASE_URL is not configured', () => {
    delete process.env.NEXTCLOUD_BASE_URL;
    expect(() => new NextcloudConnector()).toThrow(/NEXTCLOUD_BASE_URL/);
  });

  it('parses a WebDAV PROPFIND listing into documents, excluding collections', async () => {
    requestMock.mockResolvedValue({ data: WEBDAV_XML });
    const connector = new NextcloudConnector();

    const docs = await connector.listUserDocuments();

    // The collection entry is dropped; the file entry maps to a document whose
    // href is made relative to the WebDAV base path.
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      id: 'notes.md',
      name: 'notes.md',
      path: '/notes.md',
      provider: 'nextcloud',
    });
  });
});
