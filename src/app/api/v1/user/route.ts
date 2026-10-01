// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { apiErrorResponse } from '~/lib/apiErrors';
import { parseProfileUpdate } from '~/lib/auth/profileUpdate';
import { authenticate } from '~/lib/auth/session';
import { toUserDto } from '~/lib/auth/userDto';
import { prisma } from '~/lib/prisma';
import { readJsonObject } from '~/lib/requestBody';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return NextResponse.json({ user: toUserDto(await authenticate(request)) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** PUT /v1/user (server-framework parity): update the caller's own profile; `{ user }` in and out. */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await authenticate(request);
    const changes = parseProfileUpdate(await readJsonObject(request));
    const updated = await prisma.user.update({ where: { id: user.id }, data: changes });
    return NextResponse.json({ user: toUserDto(updated) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
