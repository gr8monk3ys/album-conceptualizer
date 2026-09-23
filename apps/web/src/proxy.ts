import { withAuth } from "next-auth/middleware";

// Signed-out visitors to the app are sent to sign-in before any page renders. Pages still
// resolve the session themselves; this only saves a render. (Sessions are JWTs, which is what
// `withAuth` reads.)
export default withAuth({
  pages: {
    signIn: "/sign-in",
  },
});

export const config = {
  matcher: ["/app/:path*"],
};
