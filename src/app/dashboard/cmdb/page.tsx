import { redirect } from 'next/navigation';

export default function CMDBRedirectPage() {
  redirect('/dashboard/overview');
}
