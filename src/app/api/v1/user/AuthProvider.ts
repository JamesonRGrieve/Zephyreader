// SPDX-License-Identifier: AGPL-3.0-or-later
import jwt from 'jsonwebtoken';
import { AuthError } from '~/lib/apiErrors';
import { prisma } from '~/lib/prisma';

interface JwtPayload {
  sub: string;
}

export default async function verifyJWT(request: Request) {
  const authToken = request.headers.get('authorization')?.replaceAll('Bearer ', '');

  if (!authToken) {
    throw new AuthError('Missing authorization header.');
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    // Server misconfiguration, not a client auth failure — surfaces as a 500.
    throw new Error('JWT_SECRET is not set in environment variables');
  }

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(authToken, jwtSecret) as JwtPayload;
  } catch {
    throw new AuthError('Invalid or expired token.');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    throw new AuthError('No user found for the provided token.');
  }

  return user;
}
