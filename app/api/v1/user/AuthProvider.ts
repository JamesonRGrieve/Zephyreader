import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

interface JwtPayload {
  sub: string;
}

interface VerifiedUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export default async function verifyJWT(request: Request | NextRequest): Promise<VerifiedUser> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    throw new Error('Missing authorization header.');
  }

  const authToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!authToken) {
    throw new Error('Missing authorization token.');
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not set in environment variables');
  }

  const decoded = jwt.verify(authToken, jwtSecret) as JwtPayload;

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
    throw new Error('No user found matching the email in the JWT.');
  }

  return user;
}
