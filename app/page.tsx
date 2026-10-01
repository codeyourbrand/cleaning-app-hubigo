import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";

export default async function Home() {
  const session = await verifySession();
  if (!session) redirect("/login");
  redirect(session.role === "COORDINATOR" ? "/coordinator" : "/cleaner/tasks");
}
