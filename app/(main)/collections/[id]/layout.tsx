import { SITE_URL } from "@/lib/brand"
import { Metadata } from "next"
import { getCollection } from "@/actions/monetization"
import { jsonLdHtml } from "@/lib/json-ld"

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  try {
    const data = await getCollection({ data: { id } })
    if (!data) return { title: "Collection — Nib" }
    return {
      title: `${data.collection.title} — Nib`,
      description:
        data.collection.description ??
        `Curated collection by @${data.curator?.handle ?? "author"}.`,
      openGraph: {
        title: data.collection.title,
        description: data.collection.description ?? undefined,
        type: "article",
        url: `/collections/${id}`,
      },
      alternates: {
        canonical: `/collections/${id}`,
      },
    }
  } catch {
    return { title: "Collection — Nib" }
  }
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let jsonLd = null
  try {
    const data = await getCollection({ data: { id } })
    if (data) {
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        headline: data.collection.title,
        description: data.collection.description ?? undefined,
        creator: data.curator
          ? {
              "@type": "Person",
              name: data.curator.display_name,
              alternateName: `@${data.curator.handle}`,
            }
          : undefined,
        url: `${SITE_URL}/collections/${id}`,
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
