import webpush from "web-push";
import { prisma } from "./prisma";

export function configureWebPush() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT;
  if (publicKey && privateKey && subject) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }
}

export async function savePushSubscription(userId: string, subscription: webpush.PushSubscription) {
  configureWebPush();
  return prisma.webPushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: {
      userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
}

export async function sendPushNotification(userId: string, title: string, body: string, url?: string) {
  configureWebPush();
  const subs = await prisma.webPushSubscription.findMany({ where: { userId } });
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({ title, body, url })
      );
    } catch (err) {
      console.error("Failed to send push", err);
      if ((err as any).statusCode === 410 || (err as any).statusCode === 404) {
        await prisma.webPushSubscription.delete({ where: { endpoint: sub.endpoint } });
      }
    }
  }
}
