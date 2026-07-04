import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Page() {
  const user = await getSession();
  if (user) {
    redirect('/dashboard/assets');
  } else {
    redirect('/auth/login');
  }
}
