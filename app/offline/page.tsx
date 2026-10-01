export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-bold mb-2">You are offline</h1>
      <p className="text-muted-foreground">
        Hubigo will sync your changes once the connection is back.
      </p>
    </main>
  );
}
