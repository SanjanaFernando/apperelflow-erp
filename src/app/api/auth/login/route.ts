import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  DEMO_USERS,
  attachSessionCookie,
  signSession,
  validateDemoPassword,
} from "@/lib/session";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Please enter a valid email and password.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;

  if (
    process.env.DATABASE_URL &&
    process.env.NEXT_PUBLIC_DEMO_MODE !== "true"
  ) {
    const { prisma } = await import("@/server/db");
    const databaseUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    const passwordMatches = databaseUser
      ? await bcrypt.compare(password, databaseUser.passwordHash)
      : false;

    if (!databaseUser || !passwordMatches) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "The email or password is incorrect.",
          },
        },
        { status: 401 },
      );
    }

    const token = await signSession({
      id: databaseUser.id,
      email: databaseUser.email,
      name: databaseUser.fullName,
      role: databaseUser.role,
    });
    const response = NextResponse.json({
      ok: true,
      user: {
        id: databaseUser.id,
        email: databaseUser.email,
        name: databaseUser.fullName,
        role: databaseUser.role,
      },
    });
    return attachSessionCookie(response, token);
  }

  const user = DEMO_USERS[email.toLowerCase()];

  if (!user || !validateDemoPassword(email.toLowerCase(), password)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_CREDENTIALS",
          message: "The email or password is incorrect.",
        },
      },
      { status: 401 },
    );
  }

  const token = await signSession(user);
  const response = NextResponse.json({ ok: true, user });

  return attachSessionCookie(response, token);
}
