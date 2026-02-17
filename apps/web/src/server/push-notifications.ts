import { getPrisma } from "@/server/db";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
}

export async function sendPushNotificationsToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const prisma = getPrisma();

  const tokens = await prisma.pushToken.findMany({
    where: { userId, isActive: true },
    select: { token: true },
  });

  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens.map(({ token }: { token: string }) => ({
    to: token,
    title,
    body,
    data,
    sound: "default" as const,
  }));

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });
  } catch (error) {
    console.error("Failed to send push notifications:", error);
  }
}
