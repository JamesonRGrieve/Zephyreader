// SPDX-License-Identifier: AGPL-3.0-or-later
import jwt from 'jsonwebtoken';
import { NextResponse, type NextRequest } from 'next/server';
import verifyJWT from './AuthProvider';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return NextResponse.json(await verifyJWT(request));
  } catch (error) {
    console.error('Error verifying JWT:', error);
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: `Invalid token: ${message}` }, { status: 401 });
    }
    return NextResponse.json({ error: `Error validating token: ${message}` }, { status: 401 });
  }
}
