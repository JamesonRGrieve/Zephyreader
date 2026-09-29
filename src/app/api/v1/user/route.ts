// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import { authenticate } from '~/lib/auth/session';
import { toUserDto } from '~/lib/auth/userDto';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return NextResponse.json({ user: toUserDto(await authenticate(request)) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
