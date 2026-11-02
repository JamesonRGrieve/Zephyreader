// SPDX-License-Identifier: AGPL-3.0-or-later
import { collectionRoutes } from '~/lib/records';
import { scripts } from '~/lib/teleprompterRecords';

// GET /v1/script (list) and POST /v1/script (create), as server-framework answers them.
const routes = collectionRoutes(scripts);

export const GET = routes.GET;
export const POST = routes.POST;
