// Shared layout for sign-in and sign-up: what you get on the left, the form on the right.
// Phones show the form first.
export function AuthShell({
  title,
  intro,
  points = [],
  aside,
  children,
}: {
  title: string
  intro?: React.ReactNode
  points?: string[]
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <main className="container-wide grid items-start gap-10 pt-16 pb-16 md:pt-24 md:pb-24 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-5">
        <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">{title}</h1>
        {intro && <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{intro}</p>}
        {points.length > 0 && (
          <ul className="mt-8 max-lg:hidden">
            {points.map((p) => (
              <li key={p} className="hairline-t py-3 last:hairline-b">{p}</li>
            ))}
          </ul>
        )}
        {aside && <div className="mt-6 text-sm text-muted-foreground max-lg:hidden">{aside}</div>}
      </div>
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 sm:p-8 lg:col-span-6 lg:col-start-7">
        {children}
        {aside && <div className="mt-6 text-sm text-muted-foreground lg:hidden">{aside}</div>}
      </div>
    </main>
  )
}

export function FieldError({ id, children }: { id: string; children?: React.ReactNode }) {
  if (!children) return null
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-destructive">
      {children}
    </p>
  )
}
