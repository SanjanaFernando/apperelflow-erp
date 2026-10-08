import { NextResponse } from "next/server";
import { getSessionFromCookies, type AppRole } from "@/lib/session";

export async function authenticate() {
  const session = await getSessionFromCookies();
  if (!session) {
    return null;
  }

  return session;
}

export async function requireRole(requiredRoles: AppRole[]) {
  const session = await authenticate();

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: { code: "UNAUTHENTICATED", message: "You are not signed in." },
        },
        { status: 401 },
      ),
    } as const;
  }

  if (!requiredRoles.includes(session.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have access to this action.",
          },
        },
        { status: 403 },
      ),
    } as const;
  }

  return {
    ok: true,
    session,
  } as const;
}
