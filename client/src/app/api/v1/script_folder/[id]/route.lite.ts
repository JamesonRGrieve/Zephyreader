// SPDX-License-Identifier: AGPL-3.0-or-later
import { recordRoutes } from '~/lib/records';
import { scriptFolders } from '~/lib/teleprompterRecords';

// GET, PUT (If-Match) and DELETE (If-Match) /v1/script_folder/{id}, as server-framework answers them.
const routes = recordRoutes(scriptFolders);

export const GET = routes.GET;
export const PUT = routes.PUT;
export const DELETE = routes.DELETE;
