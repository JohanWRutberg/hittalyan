/** Enkel textsida: rubrik, ingress och numrerade avsnitt. Delas av Om oss och Ansvarsfriskrivning. */
export function ProsePage({
  title,
  lead,
  sections,
  footnote,
}: {
  title: string;
  lead: string;
  sections: { title: string; body: string }[];
  footnote?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-lg text-muted">{lead}</p>
      </div>
      <div className="space-y-6">
        {sections.map((s) => (
          <section key={s.title} className="card p-6">
            <h2 className="text-lg font-semibold">{s.title}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{s.body}</p>
          </section>
        ))}
      </div>
      {footnote && <p className="text-xs text-muted">{footnote}</p>}
    </div>
  );
}
