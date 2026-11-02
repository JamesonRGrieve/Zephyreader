// SPDX-License-Identifier: AGPL-3.0-or-later
import { collectionRoutes } from '~/lib/records';
import { prompterPreferences } from '~/lib/teleprompterRecords';

// GET /v1/prompter_preference (list) and POST /v1/prompter_preference (create), as server-framework answers them.
const routes = collectionRoutes(prompterPreferences);

export const GET = routes.GET;
export const POST = routes.POST;
