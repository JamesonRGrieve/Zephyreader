/**
 * @jest-environment node
 */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { v2 as webdav } from 'webdav-server';
import { NextcloudConnector } from '@/app/api/v1/nextcloud/NextcloudConnector';

const TEST_USERNAME = 'nextcloud';
const TEST_PASSWORD = 'password';

const createServer = async (contentRoot: string, port: number) => {
  const userManager = new webdav.SimpleUserManager();
  const user = userManager.addUser(TEST_USERNAME, TEST_PASSWORD, false);

  const privilegeManager = new webdav.SimplePathPrivilegeManager();
  privilegeManager.setRights(user, '/', ['all']);

  const server = new webdav.WebDAVServer({
    port,
    httpAuthentication: new webdav.HTTPBasicAuthentication(userManager),
    privilegeManager,
  });

  await new Promise<void>((resolve, reject) => {
    server.setFileSystem('/remote.php/dav/files/nextcloud', new webdav.PhysicalFileSystem(contentRoot), (success) => {
      if (success === true) {
        resolve();
      } else {
        reject(new Error('Failed to mount file system'));
      }
    });
  });

  await new Promise<void>((resolve) => {
    server.start(() => resolve());
  });

  return server;
};

describe('NextcloudConnector', () => {
  const fileName = 'note.md';
  const fileContents = '# Sample document\nThis is markdown content from Nextcloud.';
  let server: webdav.WebDAVServer;

  beforeAll(async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'nextcloud-test-'));
    await fs.writeFile(path.join(workspace, fileName), fileContents, 'utf8');

    const port = 4000 + Math.floor(Math.random() * 1000);
    server = await createServer(workspace, port);

    process.env.NEXTCLOUD_BASE_URL = `http://127.0.0.1:${port}/remote.php/dav/files/nextcloud`;
    process.env.NEXTCLOUD_USERNAME = TEST_USERNAME;
    process.env.NEXTCLOUD_PASSWORD = TEST_PASSWORD;
    process.env.NEXTCLOUD_ROOT_PATH = '/';
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.stop(() => resolve()));
    }
  });

  it('lists available documents from Nextcloud', async () => {
    const connector = new NextcloudConnector();
    const docs = await connector.listUserDocuments();

    const foundDocument = docs.find((doc) => doc.name === fileName && doc.provider === 'nextcloud');
    expect(foundDocument).toBeDefined();
    expect(foundDocument?.path.endsWith(fileName)).toBe(true);
  });

  it('retrieves markdown content for a document', async () => {
    const connector = new NextcloudConnector();
    const document = (await connector.listUserDocuments()).find((doc) => doc.name === fileName);
    expect(document).toBeDefined();
    const content = await connector.getUserDocumentMarkdown(document!.path);

    expect(content).toContain('Sample document');
    expect(content).toContain('Nextcloud');
  });
});
