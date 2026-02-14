import NextAuth from "next-auth";

import { buildAuthOptions } from "@/server/auth";

// Build the handler lazily so importing this route never requires DB/env at build time.
function authHandler(request: Request) {
  return NextAuth(buildAuthOptions())(request);
}

export const GET = authHandler;
export const POST = authHandler;

