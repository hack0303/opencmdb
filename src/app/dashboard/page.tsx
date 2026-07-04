import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Dashboard() {
  const user = await getSession();
  if (user) {
    redirect('/dashboard/assets');
  } else {
    redirect('/auth/login');
  }
}
