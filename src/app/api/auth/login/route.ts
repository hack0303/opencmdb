import { validateCredentials, createSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let username: string;
    let password: string;

    if (contentType.includes('application/json')) {
      const body = await request.json();
      username = body.username;
      password = body.password;
    } else {
      const formData = await request.formData();
      username = formData.get('username') as string;
      password = formData.get('password') as string;
    }

    if (!username || !password) {
      if (contentType.includes('application/json')) {
        return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
      }
      return NextResponse.redirect(new URL('/auth/login?error=required', request.url));
    }

    const user = validateCredentials(username, password);
    if (!user) {
      if (contentType.includes('application/json')) {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/auth/login?error=invalid', request.url));
    }

    const token = await createSession(user);
    const target = new URL('/dashboard/assets', request.url);

    // Redirect to dashboard with session cookie
    const response = NextResponse.redirect(target);
    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/'
    });

    return response;
  } catch {
    return NextResponse.redirect(new URL('/auth/login?error=error', request.url));
  }
}
