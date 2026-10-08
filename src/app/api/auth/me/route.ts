import { NextResponse } from "next/server";
import { DEMO_USERS, getSessionFromCookies } from "@/lib/session";
import { isDatabaseConfigured, prisma } from "@/server/db";

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "You are not signed in." } },
      { status: 401 },
    );
  }

  if (isDatabaseConfigured()) {
    const databaseUser = await prisma.user.findUnique({
      where: { id: session.sub },
    });
    if (!databaseUser) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Session user not found.",
          },
        },
        { status: 401 },
      );
    }
    return NextResponse.json({
      user: {
        id: databaseUser.id,
        email: databaseUser.email,
        name: databaseUser.fullName,
        role: databaseUser.role,
      },
    });
  }

  const user = DEMO_USERS[session.email];

  if (!user) {
    return NextResponse.json(
      {
        error: { code: "UNAUTHENTICATED", message: "Session user not found." },
      },
      { status: 401 },
    );
  }

  return NextResponse.json({ user });
}
