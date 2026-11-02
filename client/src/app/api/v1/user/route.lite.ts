// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from 'next/server';
import { ApiError, apiErrorResponse } from '~/lib/apiErrors';
import { parseProfileUpdate } from '~/lib/auth/profileUpdate';
import { authenticate } from '~/lib/auth/session';
import { clearSessionCookies } from '~/lib/auth/sessionCookies';
import { toUserDto, userEntityTag, type UserDto } from '~/lib/auth/userDto';
import { updateUserUnlessModified } from '~/lib/auth/userUpdate';
import { evaluateIfMatch } from '~/lib/conditionalRequest';
import { prisma } from '~/lib/prisma';
import { readJsonObject } from '~/lib/requestBody';

function userResponse(user: UserDto): NextResponse {
  return NextResponse.json({ user }, { headers: { ETag: userEntityTag(user) } });
}

/** 412 with the row as it now stands, which the client's conflict view diffs against. */
function preconditionFailed(current: UserDto): NextResponse {
  return NextResponse.json(
    { detail: 'The record was changed since it was read', current },
    { status: 412, headers: { ETag: userEntityTag(current) } },
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return userResponse(toUserDto(await authenticate(request)));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * PUT /v1/user (server-framework parity): update the caller's own profile; `{ user }` in and out.
 * The write must name the version it was made from: no `If-Match` is refused with 428, and one
 * naming a stale `updated_at` with 412.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await authenticate(request);
    const changes = parseProfileUpdate(await readJsonObject(request));
    const current = toUserDto(user);
    const precondition = evaluateIfMatch(request.headers.get('if-match'), current.updated_at);
    if (precondition === 'absent') throw new ApiError(428, 'If-Match required');
    if (precondition === 'mismatch') return preconditionFailed(current);
    const updated = await updateUserUnlessModified(user, changes);
    if (updated === null) {
      return preconditionFailed(toUserDto(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })));
    }
    return userResponse(toUserDto(updated));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * DELETE /v1/user (server-framework parity, with its privacy extension's erasure): the caller's
 * account goes, and with it everything it holds here (scripts, folders, prompter settings; its
 * sessions and Google link cascade). Held to `If-Match` like a save: 428 without one, 412 when
 * stale. 204, and the session cookies are cleared.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await authenticate(request);
    const current = toUserDto(user);
    const precondition = evaluateIfMatch(request.headers.get('if-match'), current.updated_at);
    if (precondition === 'absent') throw new ApiError(428, 'If-Match required');
    if (precondition === 'mismatch') return preconditionFailed(current);
    const mine = { where: { createdById: user.id } };
    // Scripts before the folders they are filed in; the account last.
    await prisma.$transaction([
      prisma.script.deleteMany(mine),
      prisma.scriptFolder.deleteMany(mine),
      prisma.prompterPreference.deleteMany(mine),
      prisma.user.delete({ where: { id: user.id } }),
    ]);
    const response = new NextResponse(null, { status: 204 });
    clearSessionCookies(response);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
