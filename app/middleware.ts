import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"

const secret = new TextEncoder().encode(process.env.AUTH_SECRET)

// Routes that require authentication (relative to org slug)
const protectedPageRoutes = ["/admin", "/orders"]
const protectedApiRoutes = ["/api/admin", "/api/orders"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip non-org routes (landing page, register, static files)
  if (
    pathname === "/" ||
    pathname === "/register" ||
    pathname.startsWith("/api/register") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // Extract org slug from path: /[org]/... or /api/[org]/...
  const isApiRoute = pathname.startsWith("/api/")
  const pathParts = pathname.split("/").filter(Boolean)

  // For API routes: /api/[org]/... -> org is at index 1
  // For page routes: /[org]/... -> org is at index 0
  const orgSlug = isApiRoute ? pathParts[1] : pathParts[0]

  if (!orgSlug) {
    return NextResponse.next()
  }

  // Get the rest of the path after org slug
  const restOfPath = isApiRoute
    ? "/" + pathParts.slice(2).join("/")
    : "/" + pathParts.slice(1).join("/")

  // Check if this is a protected route
  const isProtectedPage = protectedPageRoutes.some((route) =>
    restOfPath.startsWith(route)
  )
  const isProtectedApi = protectedApiRoutes.some((route) =>
    restOfPath.startsWith(route)
  )

  // Allow POST to /api/[org]/orders (creating orders is public)
  if (isApiRoute && restOfPath === "/orders" && request.method === "POST") {
    return NextResponse.next()
  }

  // Public routes don't need auth
  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next()
  }

  // Get session token
  const token = request.cookies.get("session")?.value

  if (!token) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.redirect(new URL(`/${orgSlug}/login`, request.url))
  }

  try {
    const { payload } = await jwtVerify(token, secret)
    const sessionOrgSlug = payload.organizationSlug as string

    // Verify the session org matches the requested org
    if (sessionOrgSlug !== orgSlug) {
      if (isProtectedApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      return NextResponse.redirect(new URL(`/${orgSlug}/login`, request.url))
    }

    return NextResponse.next()
  } catch {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.redirect(new URL(`/${orgSlug}/login`, request.url))
  }
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
