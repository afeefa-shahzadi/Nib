import { Metadata } from "next"
import { getPieceBySlug } from "@/actions/content"
import { jsonLdHtml } from "@/lib/json-ld"

type Props = {
  params: Promise<{ handle: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle, slug } = await params
  try {
    const data = await getPieceBySlug({ data: { slug } })
    // null (not found) or the owner-restricted variant → no public metadata.
    if (!data || "restricted" in data)
      return { title: "Nib", robots: { index: false } }
    // Don't leak NSFW title/summary into OG tags scraped by embeds/crawlers.
    if (data.piece.is_nsfw)
      return { title: "Nib", robots: { index: false } }
    return {
      title: `${data.piece.title} — Nib`,
      description: data.piece.summary ?? undefined,
      openGraph: {
        title: data.piece.title,
        description: data.piece.summary ?? undefined,
        type: "article",
        url: `/u/${handle}/${slug}`,
        images: [`/api/og/${handle}/${slug}`],
      },
      twitter: {
        card: "summary_large_image",
        title: data.piece.title,
        description: data.piece.summary ?? undefined,
        images: [`/api/og/${handle}/${slug}`],
      },
      alternates: {
        // Imported pieces point canonical at the original source so it keeps its
        // search credit and this copy avoids a duplicate-content penalty.
        canonical: data.piece.source_url || `/u/${handle}/${slug}`,
      },
    }
  } catch {
    return { title: "Nib" }
  }
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ handle: string; slug: string }>
}) {
  const { handle, slug } = await params
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  let jsonLd = null
  try {
    const data = await getPieceBySlug({ data: { slug } })
    if (data && !("restricted" in data) && !data.piece.is_nsfw) {
      const pieceUrl = `${base}/u/${handle}/${slug}`
      // @graph so answer engines get the article, its author, and breadcrumbs in
      // one payload — the structured signals GEO/AEO leans on.
      jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Article",
            "@id": `${pieceUrl}#article`,
            headline: data.piece.title,
            description: data.piece.summary ?? undefined,
            datePublished: data.piece.published_at ?? undefined,
            image: `${base}/api/og/${handle}/${slug}`,
            mainEntityOfPage: pieceUrl,
            url: pieceUrl,
            isAccessibleForFree: true,
            author: data.author
              ? {
                  "@type": "Person",
                  name: data.author.display_name,
                  url: `${base}/u/${handle}`,
                }
              : undefined,
            publisher: {
              "@type": "Organization",
              name: "Nib",
              url: base,
            },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Nib", item: base },
              {
                "@type": "ListItem",
                position: 2,
                name: data.author?.display_name ?? handle,
                item: `${base}/u/${handle}`,
              },
              { "@type": "ListItem", position: 3, name: data.piece.title, item: pieceUrl },
            ],
          },
        ],
      }
    }
  } catch {}

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
        />
      )}
      {children}
    </>
  )
}
