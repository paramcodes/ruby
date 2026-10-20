import Link from "next/link";

export default function PageNotFound() {
  return (
    <div>
      <h1>Page not found</h1>
      <p>
        This page does not exist, or it belongs to another workspace.{" "}
        <Link href="/">Return to your workspace</Link>.
      </p>
    </div>
  );
}
