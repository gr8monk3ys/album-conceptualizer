import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import GitHubProvider from "next-auth/providers/github";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { getPrisma } from "@/server/db";
import { trackProductEventSafe } from "@/server/analytics";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

function getConfiguredEmailServer(): string | null {
  const emailServer = process.env.EMAIL_SERVER?.trim();
  if (emailServer) return emailServer;

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (!resendApiKey) return null;

  const encoded = encodeURIComponent(resendApiKey);
  return `smtp://resend:${encoded}@smtp.resend.com:465`;
}

function getConfiguredEmailFrom(): string {
  const configured =
    process.env.AUTH_EMAIL_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim();
  if (configured) return configured;

  // Resend's default sender works for initial setup/tests before a custom domain is verified.
  return "onboarding@resend.dev";
}

let _cachedAuthOptions: NextAuthOptions | null = null;

export function buildAuthOptions(): NextAuthOptions {
  if (_cachedAuthOptions) return _cachedAuthOptions;
  const prisma = getPrisma();
  const authSecret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!authSecret) {
    throw new Error("NEXTAUTH_SECRET (or AUTH_SECRET) is not set.");
  }

  const providers: NextAuthOptions["providers"] = [];

  if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
    providers.push(
      GitHubProvider({
        clientId: getRequiredEnv("GITHUB_ID"),
        clientSecret: getRequiredEnv("GITHUB_SECRET"),
      }),
    );
  }

  const emailServer = getConfiguredEmailServer();
  if (emailServer) {
    providers.push(
      EmailProvider({
        server: emailServer,
        from: getConfiguredEmailFrom(),
        maxAge: 24 * 60 * 60,
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
    throw new Error(
      "No auth providers configured. Set GitHub OAuth, Email auth (EMAIL_SERVER or RESEND_API_KEY), or ENABLE_DEV_LOGIN=1.",
    );
  }

  const options: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    secret: authSecret,
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
        const workspace = await prisma.workspace.create({
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

        await trackProductEventSafe({
          name: "user_signed_up",
          workspaceId: workspace.id,
          userId: user.id,
          source: "auth",
          path: "/api/auth/[...nextauth]",
          metadata: {
            email: user.email ?? null,
          },
        });
      },
    },
  };

  _cachedAuthOptions = options;
  return options;
}

export async function getAuthSession() {
  return getServerSession(buildAuthOptions());
}
