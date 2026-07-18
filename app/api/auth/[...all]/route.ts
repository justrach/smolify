import { createAuth } from "@/lib/auth";

async function handler(request: Request) {
  const auth = await createAuth(request);
  return auth.handler(request);
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
