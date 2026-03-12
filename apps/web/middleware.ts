import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

export default withAuth(
  (request) => {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", request.nextUrl.pathname);
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  },
  {
    pages: {
      signIn: "/sign-in",
    },
  },
);

export const config = {
  matcher: ["/app/:path*"],
};
