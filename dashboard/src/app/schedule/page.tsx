import { redirect } from 'next/navigation';

export default function SchedulePage() {
  redirect('/system?tab=schedule');
}
