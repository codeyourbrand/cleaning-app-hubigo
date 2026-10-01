"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => console.log("SW registered"))
        .catch((err) => console.error("SW registration failed", err));
    }
  }, []);
  return null;
}

export function SubscribeToPush() {
  async function subscribe() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toastError("Push notifications not supported");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      toastError("Permission denied");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY || "",
      ),
    });
    await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
  }

  return (
    <button
      onClick={subscribe}
      className="text-sm text-primary underline"
      aria-label="Enable notifications"
    >
      Enable push notifications
    </button>
  );
}

function toastError(msg: string) {
  // Avoid importing toast here to keep component dependency small
  alert(msg);
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData.split("").map((c) => c.charCodeAt(0)));
}
