// SPDX-License-Identifier: AGPL-3.0-or-later
import { recordRoutes } from '~/lib/records';
import { scripts } from '~/lib/teleprompterRecords';

// GET, PUT (If-Match) and DELETE (If-Match) /v1/script/{id}, as server-framework answers them.
const routes = recordRoutes(scripts);

export const GET = routes.GET;
export const PUT = routes.PUT;
export const DELETE = routes.DELETE;
