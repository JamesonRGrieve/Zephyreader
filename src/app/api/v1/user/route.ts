// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import verifyJWT from './AuthProvider';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return NextResponse.json(await verifyJWT(request));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
