import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Authentication | Sign In',
  description: 'Sign In page for authentication.'
};

export default async function Page() {
  const user = await getSession();
  if (user) redirect('/dashboard/assets');
  // Will render login page in the [login] route
  redirect('/auth/login');
}
