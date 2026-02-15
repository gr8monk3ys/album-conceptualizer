import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { getPrisma } from "@/server/db";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

export function buildAuthOptions(): NextAuthOptions {
  const prisma = getPrisma();

  const providers: NextAuthOptions["providers"] = [];

  if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
    providers.push(
      GitHubProvider({
        clientId: getRequiredEnv("GITHUB_ID"),
        clientSecret: getRequiredEnv("GITHUB_SECRET"),
      }),
    );
  }

  const enableDevLogin =
    process.env.ENABLE_DEV_LOGIN === "1" &&
    (process.env.NODE_ENV !== "production" || process.env.AC_E2E === "1");
  if (enableDevLogin) {
    // DEV ONLY. A credentials provider that lets us test end-to-end flows locally without OAuth setup.
    providers.unshift(
      CredentialsProvider({
        name: "Dev Login",
        credentials: {
          email: { label: "Email", type: "text" },
          name: { label: "Name", type: "text" },
        },
        authorize: async (credentials) => {
          const rawEmail = credentials?.email;
          const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
          if (!email) return null;
          const rawName = credentials?.name;
          const name =
            typeof rawName === "string" && rawName.trim()
              ? rawName.trim()
              : email.split("@")[0] ?? "Dev User";

          const user = await prisma.user.upsert({
            where: { email },
            create: { email, name },
            update: { name },
          });

          return user;
        },
      }),
    );
  }

  if (!providers.length) {
    throw new Error("No auth providers configured. Set GitHub OAuth or ENABLE_DEV_LOGIN=1.");
  }

  return {
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    pages: { signIn: "/sign-in" },
    providers,
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
