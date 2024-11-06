import { AUTH_SESSION_COOKIE, getSession } from "@lib/auth";
import { type User } from "@prisma/client";
import { defineMiddleware } from "astro:middleware";

export const auth = defineMiddleware(
  async ({ cookies, locals, url, redirect }, next) => {
    const sessionId = cookies.get(AUTH_SESSION_COOKIE)?.value;
    const pathname = url.pathname;
    const publicRoutes = ["/sign-in", "/sign-up", "/forgot-password"];
    
    if (pathname.startsWith("/api/auth")) return next();

    let user: User | undefined;
    if (sessionId) {
      const session = await getSession(sessionId);
      if (session?.user) {
        user = session.user;
        locals.session = session;
        locals.user = user;

        if (publicRoutes.includes(pathname)) {
          return redirect("/dashboard");
        }
      } else {
        cookies.delete(AUTH_SESSION_COOKIE, {
          httpOnly: true,
          secure: import.meta.env.PROD,
          path: "/",
        });
      }
    } else if (!publicRoutes.includes(pathname)) {
      return redirect("/sign-in");
    }

    if (url.pathname.startsWith("/_action")) return next();
    if (url.pathname.startsWith("/auth")) return next();

    if (url.pathname.startsWith("/instructor") && user?.role !== "INSTRUCTOR") {
      return new Response("Not Found", { status: 404 });
    }

    const res = await next();
    locals.session = null;
    locals.user = null;
    return res;
  },
);
