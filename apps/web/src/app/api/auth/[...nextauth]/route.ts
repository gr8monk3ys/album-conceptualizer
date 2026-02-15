import NextAuth from "next-auth/next";
import type { NextRequest } from "next/server";

import { buildAuthOptions } from "@/server/auth";

// Build the handler lazily so importing this route never requires DB/env at build time.
function getAuthHandler() {
  return NextAuth(buildAuthOptions());
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  const params = await ctx.params;
  return getAuthHandler()(request, { params });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  const params = await ctx.params;
  return getAuthHandler()(request, { params });
}
