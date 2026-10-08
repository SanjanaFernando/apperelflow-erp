import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { REJECTION_NOTE_MIN_LENGTH } from "@/lib/constants";

export { REJECTION_NOTE_MIN_LENGTH } from "@/lib/constants";

export type AppRole =
  | "cutting_supervisor"
  | "cutting_verifier"
  | "sewing_supervisor";

export type DemoUser = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
};

export const DEMO_USERS: Record<string, DemoUser> = {
  "supervisor@apparelflow.demo": {
    id: "u-cutting-supervisor",
    email: "supervisor@apparelflow.demo",
    name: "Ava Chen",
    role: "cutting_supervisor",
  },
  "verifier@apparelflow.demo": {
    id: "u-cutting-verifier",
    email: "verifier@apparelflow.demo",
    name: "Milo Ortiz",
    role: "cutting_verifier",
  },
  "sewing@apparelflow.demo": {
    id: "u-sewing-supervisor",
    email: "sewing@apparelflow.demo",
    name: "Nia Patel",
    role: "sewing_supervisor",
  },
};

const DEMO_PASSWORDS: Record<string, string> = {
  "supervisor@apparelflow.demo": "Supervisor#2026",
  "verifier@apparelflow.demo": "Verifier#2026",
  "sewing@apparelflow.demo": "Sewing#2026",
};

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "apparelflow-demo-secret-dev-only",
);

export async function signSession(user: DemoUser) {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(JWT_SECRET);
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as {
    sub: string;
    email: string;
    name: string;
    role: AppRole;
  };
}

export async function getSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get("apparelflow_session")?.value;

  if (!token) {
    return null;
  }

  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

export function attachSessionCookie(response: NextResponse, token: string) {
  response.cookies.set("apparelflow_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set("apparelflow_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export function validateDemoPassword(email: string, password: string) {
  return DEMO_PASSWORDS[email] === password;
}
