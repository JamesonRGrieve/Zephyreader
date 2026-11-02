// SPDX-License-Identifier: AGPL-3.0-or-later
import { recordRoutes } from '~/lib/records';
import { prompterPreferences } from '~/lib/teleprompterRecords';

// GET, PUT (If-Match) and DELETE (If-Match) /v1/prompter_preference/{id}, as server-framework answers them.
const routes = recordRoutes(prompterPreferences);

export const GET = routes.GET;
export const PUT = routes.PUT;
export const DELETE = routes.DELETE;
