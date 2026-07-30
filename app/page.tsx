export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-3">
        <p className="text-sm uppercase tracking-widest text-neutral-500">Pace</p>
        <h1 className="text-3xl font-semibold tracking-tight">Phase 1 — seed</h1>
        <p className="text-neutral-600 text-sm leading-relaxed">
          SQLite is loaded from <code className="text-neutral-900">/data</code>.
          Math and screens start after you green-light Phase 2.
        </p>
      </div>
    </main>
  );
}
