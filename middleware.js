import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(req) {
  let res = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value;
        },
        set(name, value, options) {
          req.cookies.set({ name, value, ...options });
          res = NextResponse.next({ request: { headers: req.headers } });
          res.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          req.cookies.set({ name, value: "", ...options });
          res = NextResponse.next({ request: { headers: req.headers } });
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;
  const isAppRoute = path.startsWith("/app") || path.startsWith("/admin");
  const isLoginRoute = path === "/login";
  const isAuthRoute = path.startsWith("/reset-password") || path.startsWith("/update-password");
  const isApiRoute = path.startsWith("/api");

  // Always allow API and auth routes
  if (isApiRoute || isAuthRoute) return res;

  // No session + trying to access app → redirect to login
  if (!session && isAppRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Has session + on login page → redirect to app
  if (session && isLoginRoute) {
    return NextResponse.redirect(new URL("/app", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
