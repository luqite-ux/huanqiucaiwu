import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const protectedPrefixes = ["/dashboard", "/reimbursements", "/finance", "/admin"];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((p) => pathname.startsWith(p));
}

function needsRoleGate(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/finance") ||
    pathname.startsWith("/reimbursements/new") ||
    pathname.startsWith("/reimbursements/mine")
  );
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && needsRoleGate(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role as string | undefined;

    const deny = () => {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.searchParams.set("denied", "1");
      return NextResponse.redirect(url);
    };

    if (pathname.startsWith("/admin")) {
      if (role !== "super_admin") return deny();
    }

    if (pathname.startsWith("/finance")) {
      if (role !== "finance_admin") return deny();
    }

    if (
      pathname.startsWith("/reimbursements/new") ||
      pathname.startsWith("/reimbursements/mine")
    ) {
      if (role !== "employee") return deny();
    }
  }

  if (pathname === "/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (pathname === "/" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (pathname === "/" && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
