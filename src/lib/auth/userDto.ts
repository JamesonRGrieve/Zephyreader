// SPDX-License-Identifier: AGPL-3.0-or-later
import type { User } from '@prisma/client';
import { entityTag } from '~/lib/conditionalRequest';

export type UserDto = ReturnType<typeof toUserDto>;

/** server-framework's user DTO (GET /v1/user): snake_case, never any credential fields. */
export function toUserDto(user: User) {
  return {
    id: user.id,
    created_at: user.createdAt.toISOString(),
    created_by_user_id: null,
    updated_at: user.updatedAt.toISOString(),
    updated_by_user_id: null,
    image_url: user.imageUrl,
    email: user.email,
    username: null,
    display_name: user.displayName,
    first_name: user.firstName,
    last_name: user.lastName,
    mfa_count: 0,
    active: user.active,
    timezone: user.timezone,
    language: user.language,
  };
}

/** The user row's entity tag: its serialised `updated_at`, exactly as the DTO carries it. */
export function userEntityTag(dto: UserDto): string {
  return entityTag(dto.updated_at);
}
