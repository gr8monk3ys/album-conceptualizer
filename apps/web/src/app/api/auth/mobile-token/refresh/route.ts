import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";

import { getMobileJwtSecret } from "@/server/auth";
import { getPrisma } from "@/server/db";

/**
 * POST /api/auth/mobile-token/refresh
 *
 * Accepts a valid (non-expired) Bearer JWT and returns a fresh one with a new
 * 30-day expiry. The caller must pass the current token in the Authorization
 * header as `Bearer <token>`.
 *
 * Returns: { jwt: string, user: { id, name, email, image } }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing Bearer token in Authorization header." },
      { status: 401 },
    );
  }

  const token = authHeader.slice(7);
  if (!token) {
    return NextResponse.json(
      { error: "Empty Bearer token." },
      { status: 401 },
    );
  }

  const secret = getMobileJwtSecret();

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    if (!payload.sub || typeof payload.sub !== "string") {
      return NextResponse.json(
        { error: "Invalid token payload." },
        { status: 401 },
      );
    }
    userId = payload.sub;
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired token." },
      { status: 401 },
    );
  }

  // Verify the user still exists in the database.
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User no longer exists." },
      { status: 401 },
    );
  }

  // Issue a fresh token.
  const newJwt = await new SignJWT({
    sub: user.id,
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  return NextResponse.json({
    jwt: newJwt,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
  });
}
