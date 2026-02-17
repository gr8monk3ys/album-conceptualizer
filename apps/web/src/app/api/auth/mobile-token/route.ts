import { NextResponse } from "next/server";
import { SignJWT } from "jose";

import { getAuthSession, getMobileJwtSecret } from "@/server/auth";
import { getPrisma } from "@/server/db";

/**
 * POST /api/auth/mobile-token
 *
 * Issues a signed JWT for mobile clients. Requires a valid NextAuth cookie
 * session (i.e. the user must already be signed in on the web). This is useful
 * for scenarios where the mobile app can piggyback on an existing web session
 * (e.g. via a deep-link from the web dashboard).
 *
 * Returns: { jwt: string, user: { id, name, email, image } }
 */
export async function POST() {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized. A valid session is required to issue a mobile token." },
      { status: 401 },
    );
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found." },
      { status: 404 },
    );
  }

  const secret = getMobileJwtSecret();

  const jwt = await new SignJWT({
    sub: user.id,
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  return NextResponse.json({
    jwt,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
  });
}
