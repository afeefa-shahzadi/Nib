const EMAIL = /([^\s@]+@[^\s@]+\.[a-z]{2,})/gi

// Email addresses in legal copy become mailto links.
function linkEmails(text: string) {
  return text.split(EMAIL).map((part, i) =>
    i % 2 ? (
      <a key={i} href={`mailto:${part}`} className="font-medium text-primary hover:underline hover:underline-offset-4">
        {part}
      </a>
    ) : (
      part
    )
  )
}

// Shared layout for long legal documents: title and summary, then a sticky
// "On this page" list beside the sections on desktop.
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string
  updated: string
  intro: string
  sections: { h: string; b: string }[]
}) {
  const id = (h: string) => h.toLowerCase().replace(/^\d+\.\s*/, "").replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <section className="container-wide pt-16 pb-12 md:pt-24">
          <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">{title}</h1>
          <p className="mt-4 text-sm text-muted-foreground">Last updated {updated}</p>
          <p className="mt-6 max-w-[38rem] text-lg leading-relaxed text-foreground/85">{intro}</p>
        </section>

        <section className="hairline-t">
          <div className="container-wide grid items-start gap-10 py-16 lg:grid-cols-12 lg:gap-12">
            <nav aria-label="On this page" className="hidden lg:sticky lg:top-24 lg:col-span-4 lg:block">
              <p className="text-sm font-medium">On this page</p>
              <ol className="mt-3 space-y-1">
                {sections.map((s) => (
                  <li key={s.h}>
                    <a
                      href={`#${id(s.h)}`}
                      className="block py-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      {s.h}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="space-y-10 lg:col-span-8">
              {sections.map((s) => (
                <div key={s.h} id={id(s.h)} className="scroll-mt-24">
                  <h2 className="font-display text-2xl leading-tight">{s.h}</h2>
                  <p className="mt-3 max-w-[65ch] leading-relaxed text-muted-foreground">{linkEmails(s.b)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
