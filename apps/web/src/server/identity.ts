import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { getAuthSession } from "@/server/auth";

/**
 * For Server Components / page routes.  Redirects to the sign-in page when
 * the user is not authenticated.
 */
export async function requireUser() {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) redirect("/sign-in");
  return { session, userId };
}

/**
 * For API route handlers.  Returns the authenticated userId or a 401
 * JSON response that the caller can return directly.
 *
 * Usage:
 * ```ts
 * const auth = await requireApiUser();
 * if (auth.error) return auth.error;
 * const { userId, session } = auth;
 * ```
 */
export async function requireApiUser(): Promise<
  | { error: NextResponse; userId?: undefined; session?: undefined }
  | { error?: undefined; userId: string; session: NonNullable<Awaited<ReturnType<typeof getAuthSession>>> }
> {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId || !session) {
    return {
      error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }
  return { userId, session };
}

