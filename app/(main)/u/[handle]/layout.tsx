import { SITE_URL } from "@/lib/brand"
import { Metadata } from "next"
import { getAuthorByHandle } from "@/actions/content"
import { jsonLdHtml } from "@/lib/json-ld"

type Props = {
  params: Promise<{ handle: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params
  try {
    const data = await getAuthorByHandle({ data: { handle } })
    if (!data) return { title: "Author — Nib" }
    return {
      title: `${data.author.display_name} (@${data.author.handle}) — Nib`,
      description:
        data.author.bio ??
        `Pieces, branches, and memberships by @${handle} on Nib.`,
      openGraph: {
        title: `${data.author.display_name} (@${data.author.handle})`,
        description: data.author.bio ?? "Nib author profile.",
        type: "profile",
        url: `/u/${handle}`,
        images: [`/api/og/${handle}`],
      },
      twitter: {
        card: "summary_large_image",
        images: [`/api/og/${handle}`],
      },
      alternates: {
        canonical: `/u/${handle}`,
      },
    }
  } catch {
    return { title: "Author — Nib" }
  }
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  let jsonLd = null
  try {
    const data = await getAuthorByHandle({ data: { handle } })
    if (data) {
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        mainEntity: {
          "@type": "Person",
          name: data.author.display_name,
          alternateName: `@${data.author.handle}`,
          description: data.author.bio ?? undefined,
          image: data.author.avatar_url ?? undefined,
          url: `${SITE_URL}/u/${handle}`,
        },
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
