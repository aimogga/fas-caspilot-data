import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <div style={{ maxWidth: '600px', margin: '100px auto', padding: '20px', textAlign: 'center' }}>
      <h1>403 - Forbidden</h1>
      <p>You do not have permission to access this page.</p>
      <Link href="/" style={{ color: '#0070f3', textDecoration: 'underline' }}>
        Go to Home
      </Link>
    </div>
  );
}
