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

// ---------------------------------------------------------------------------
// Production-readiness: verify critical env vars on first use.
// ---------------------------------------------------------------------------
let _envChecked = false;
function assertProductionEnv(): void {
  if (_envChecked) return;
  _envChecked = true;

  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) return;

  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error(
      "NEXTAUTH_SECRET must be set in production. Generate one with `openssl rand -base64 32`.",
    );
  }
  if (!process.env.NEXTAUTH_URL) {
    // NextAuth can auto-detect on Vercel, but log a warning for other hosts.
    console.warn(
      "[auth] NEXTAUTH_URL is not set. NextAuth will attempt auto-detection, " +
        "but it is recommended to set it explicitly in production.",
    );
  }
}

export function buildAuthOptions(): NextAuthOptions {
  assertProductionEnv();

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
    process.env.NODE_ENV !== "production";
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

  const isProduction = process.env.NODE_ENV === "production";
  const useSecureCookies = isProduction;

  // Cookie prefix used by NextAuth when `useSecureCookies` is true.
  const cookiePrefix = useSecureCookies ? "__Secure-" : "";

  return {
    adapter: PrismaAdapter(prisma),
    secret: process.env.NEXTAUTH_SECRET,
    session: {
      strategy: "jwt",
      // 30 days (in seconds). After this the user must re-authenticate.
      maxAge: 30 * 24 * 60 * 60,
      // Re-sign the JWT once per day so the expiry keeps sliding forward
      // while the user is active.
      updateAge: 24 * 60 * 60,
    },
    pages: { signIn: "/sign-in" },
    providers,

    // -----------------------------------------------------------------------
    // Cookie hardening
    // -----------------------------------------------------------------------
    // In production every cookie is Secure, HttpOnly and SameSite=Lax.
    // NextAuth sets sensible defaults but we make them explicit here so that
    // any future NextAuth upgrade cannot silently weaken them.
    // -----------------------------------------------------------------------
    cookies: {
      sessionToken: {
        name: `${cookiePrefix}next-auth.session-token`,
        options: {
          httpOnly: true,
          sameSite: "lax" as const,
          path: "/",
          secure: useSecureCookies,
        },
      },
      callbackUrl: {
        name: `${cookiePrefix}next-auth.callback-url`,
        options: {
          httpOnly: true,
          sameSite: "lax" as const,
          path: "/",
          secure: useSecureCookies,
        },
      },
      csrfToken: {
        // The CSRF token cookie is intentionally NOT httpOnly so that the
        // NextAuth client JS can read it and include it in POST requests.
        // This is by design in NextAuth's CSRF protection mechanism.
        name: `${useSecureCookies ? "__Host-" : ""}next-auth.csrf-token`,
        options: {
          httpOnly: false,
          sameSite: "lax" as const,
          path: "/",
          secure: useSecureCookies,
        },
      },
    },

    callbacks: {
      jwt: async ({ token, user }) => {
        // On initial sign-in `user` is defined — persist only the id.
        if (user) {
          token.sub = user.id;
        }
        // Return only the fields NextAuth needs in the JWT.  This keeps the
        // token lean and avoids accidentally leaking data to the client.
        return {
          sub: token.sub,
          iat: token.iat,
          exp: token.exp,
          jti: token.jti,
        };
      },
      session: async ({ session, token }) => {
        if (session.user) {
          // Expose only the user id on the client session.
          session.user.id = token.sub ?? "";
        }
        return session;
      },
      signIn: async () => {
        // No special bypass logic — all configured providers are trusted.
        // Returning true is the safe default; add provider-specific checks
        // (e.g. email domain restrictions) here if needed in the future.
        return true;
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
