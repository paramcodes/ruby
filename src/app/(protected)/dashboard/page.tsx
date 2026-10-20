import { getCurrentUser } from "@/server/auth/current-user";

export default async function DashboardPage() {
  // Request-cached: shares the layout's session lookup, no extra DB round-trip.
  const user = await getCurrentUser();

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Signed in as {user?.id}</p>
    </main>
  );
}
