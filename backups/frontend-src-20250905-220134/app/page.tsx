import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <main className="flex max-w-4xl flex-col items-center gap-8 text-center">
        <h1 className="text-5xl font-bold">Welcome to MediaNest</h1>
        <p className="text-xl text-muted-foreground">Your unified portal for media management</p>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-primary px-6 py-3 text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Login with Plex
          </Link>
          <Link
            href="/docs"
            className="rounded-lg border border-border px-6 py-3 transition-colors hover:bg-secondary"
          >
            Documentation
          </Link>
        </div>
      </main>
    </div>
  );
}
