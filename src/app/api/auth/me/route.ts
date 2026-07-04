import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: { username: user.username, name: user.name, email: user.email }
  });
}
