import { redirect } from 'next/navigation';

export default function LogsPage() {
  redirect('/system?tab=logs');
}
