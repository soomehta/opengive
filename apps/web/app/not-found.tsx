import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen text-center px-4"
      style={{ backgroundColor: 'var(--surface-ground)', color: 'var(--text-primary)' }}
    >
      <h1
        className="text-6xl font-bold mb-4"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-trust)' }}
      >
        404
      </h1>
      <p className="text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
        Page not found
      </p>
      <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all duration-300"
        style={{
          backgroundColor: 'var(--accent-trust)',
          color: 'white',
        }}
      >
        Go Home
      </Link>
    </div>
  );
}
