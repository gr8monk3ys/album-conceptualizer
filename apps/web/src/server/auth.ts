import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import GitHubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { getPrisma } from "@/server/db";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

export function buildAuthOptions(): NextAuthOptions {
  const prisma = getPrisma();

  return {
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    pages: { signIn: "/sign-in" },
    providers: [
      GitHubProvider({
        clientId: getRequiredEnv("GITHUB_ID"),
        clientSecret: getRequiredEnv("GITHUB_SECRET"),
      }),
    ],
    callbacks: {
      session: async ({ session, token }) => {
        if (session.user) {
          // Expose user id on the client.
          session.user.id = token.sub ?? "";
        }
        return session;
      },
    },
    events: {
      createUser: async ({ user }) => {
        // Bootstrap a personal workspace on first sign-in.
        // This keeps the rest of the app logic simple.
        await prisma.workspace.create({
          data: {
            name: user.name ? `${user.name}'s Workspace` : "My Workspace",
            ownerId: user.id,
            members: {
              create: {
                userId: user.id,
                role: "owner",
              },
            },
            subscription: {
              create: {
                plan: "free",
                status: "inactive",
              },
            },
          },
        });
      },
    },
  };
}

export async function getAuthSession() {
  return getServerSession(buildAuthOptions());
}

