type ScaffoldPageProps = {
  title: string;
  description: string;
  area?: "User" | "Admin" | "Account";
};

export function ScaffoldPage({ title, description, area = "User" }: ScaffoldPageProps) {
  return (
    <main className="panel">
      <p className="eyebrow">{area} workspace</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </main>
  );
}
