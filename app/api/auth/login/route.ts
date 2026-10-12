import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mapLoginError, type LoginError } from '@/lib/auth/login-errors';

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

function jsonError(error: LoginError, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return jsonError(mapLoginError(null), 503);
  }
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return jsonError(mapLoginError(null), 400);
  }
  const email = body.email;
  const password = body.password;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return jsonError(mapLoginError(null), 400);
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const status = error.status === 429 ? 429 : 401;
    return jsonError(mapLoginError(error), status);
  }
  return NextResponse.json({ ok: true });
}
