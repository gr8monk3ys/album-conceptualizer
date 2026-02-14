import { redirect } from "next/navigation";

import { getAuthSession } from "@/server/auth";

export async function requireUser() {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) redirect("/sign-in");
  return { session, userId };
}

