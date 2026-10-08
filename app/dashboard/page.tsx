import { listEntities } from "../actions";
import Shell from "../Shell";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  
  if (!sessionCookie) {
    redirect("/");
  }

  const session = JSON.parse(Buffer.from(sessionCookie, "base64").toString("utf-8"));
  let entities = await listEntities();

  if (session.role === "COMPANY" && session.entityId) {
    entities = entities.filter(e => e.id === session.entityId);
  }

  return <Shell initialEntities={entities} session={session} />;
}
