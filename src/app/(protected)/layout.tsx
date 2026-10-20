import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/current-user";

export default async function ProtectedLayout({
  children
}: Readonly<React.PropsWithChildren>) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  return children;
}
