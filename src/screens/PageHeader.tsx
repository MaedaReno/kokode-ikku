export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}
    </header>
  );
}
