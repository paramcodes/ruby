import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/current-user";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Signed in as {user.id}</p>
    </main>
  );
}