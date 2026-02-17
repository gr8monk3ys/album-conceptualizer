import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SignJWT } from "jose";

import { getMobileJwtSecret } from "@/server/auth";
import { getPrisma } from "@/server/db";

/**
 * POST /api/auth/mobile
 *
 * Exchanges a GitHub OAuth authorization code for a JWT that the mobile app
 * can store and use as a Bearer token on subsequent requests.
 *
 * Body: { code: string, redirect_uri: string }
 * Returns: { jwt: string, user: { id, name, email, image } }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { code, redirect_uri } = body;

  if (!code || typeof code !== "string") {
    return NextResponse.json(
      { error: "Missing authorization code" },
      { status: 400 },
    );
  }

  const clientId = process.env.GITHUB_ID;
  const clientSecret = process.env.GITHUB_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured" },
      { status: 503 },
    );
  }

  // Exchange the authorization code for a GitHub access token.
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri,
    }),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    return NextResponse.json(
      { error: `GitHub OAuth error: ${tokenData.error_description ?? tokenData.error}` },
      { status: 401 },
    );
  }

  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return NextResponse.json(
      { error: "No access token received from GitHub" },
      { status: 401 },
    );
  }

  // Fetch the GitHub user profile.
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userRes.ok) {
    return NextResponse.json(
      { error: "Failed to fetch GitHub user profile" },
      { status: 401 },
    );
  }

  const ghUser = await userRes.json();

  // Fetch primary email if not public.
  let email = ghUser.email;
  if (!email) {
    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (emailRes.ok) {
      const emails: { email: string; primary: boolean; verified: boolean }[] =
        await emailRes.json();
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary?.email ?? emails[0]?.email ?? null;
    }
  }

  const prisma = getPrisma();

  // Find or create the user and link the GitHub account.
  let account = await prisma.account.findFirst({
    where: {
      provider: "github",
      providerAccountId: String(ghUser.id),
    },
    include: { user: true },
  });

  let user;

  if (account) {
    user = account.user;
    // Update profile fields.
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: ghUser.name ?? ghUser.login,
        image: ghUser.avatar_url,
      },
    });
  } else {
    // Check if a user with this email already exists.
    const existingUser = email
      ? await prisma.user.findUnique({ where: { email } })
      : null;

    if (existingUser) {
      user = existingUser;
    } else {
      // Create a new user with a workspace (matching the NextAuth createUser event).
      user = await prisma.user.create({
        data: {
          name: ghUser.name ?? ghUser.login,
          email,
          image: ghUser.avatar_url,
        },
      });

      // Bootstrap personal workspace.
      await prisma.workspace.create({
        data: {
          name: `${user.name ?? "My"}'s Workspace`,
          ownerId: user.id,
          members: { create: { userId: user.id, role: "owner" } },
          subscription: { create: { plan: "free", status: "inactive" } },
        },
      });
    }

    // Link the GitHub account.
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "oauth",
        provider: "github",
        providerAccountId: String(ghUser.id),
        access_token: accessToken,
        token_type: "bearer",
        scope: tokenData.scope ?? "",
      },
    });
  }

  // Issue a JWT for the mobile client, signed with MOBILE_JWT_SECRET (or
  // NEXTAUTH_SECRET as fallback). The backend's getAuthSession() will
  // validate these tokens on subsequent requests.
  const secret = getMobileJwtSecret();

  const jwt = await new SignJWT({ sub: user.id, email: user.email })
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
