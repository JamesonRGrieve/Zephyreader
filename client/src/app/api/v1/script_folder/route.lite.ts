// SPDX-License-Identifier: AGPL-3.0-or-later
import { collectionRoutes } from '~/lib/records';
import { scriptFolders } from '~/lib/teleprompterRecords';

// GET /v1/script_folder (list) and POST /v1/script_folder (create), as server-framework answers them.
const routes = collectionRoutes(scriptFolders);

export const GET = routes.GET;
export const POST = routes.POST;
