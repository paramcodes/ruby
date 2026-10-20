import { RequireSession } from "@/components/workspace/require-session";

export default async function ProtectedLayout({
  children
}: Readonly<React.PropsWithChildren>) {
  return RequireSession({ children });
}
