import { BRAND_NAME, SITE_URL } from "@/lib/brand"
import { NIB_EMAIL as C } from "@/lib/email-layout"
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from "react-email"

interface NibDispatchProps {
  authorName: string
  authorAvatar?: string
  pieceTitle: string
  pieceSummary: string
  pieceUrl: string
  unsubscribeUrl?: string
}

export const NibDispatchEmail = ({
  authorName = "Author",
  authorAvatar,
  pieceTitle = "Untitled Piece",
  pieceSummary = "This is a summary of the piece...",
  pieceUrl = SITE_URL,
  unsubscribeUrl = "#",
}: NibDispatchProps) => {
  const previewText = `${authorName} published: ${pieceTitle}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto px-2" style={{ background: C.bg, fontFamily: C.sans }}>
          <Container className="mx-auto my-10 max-w-116.25 rounded-xl border border-solid border-[#e5dfd5] p-8" style={{ background: C.card }}>
            <Section className="mt-2 mb-4 text-center">
              <Link href={SITE_URL} style={{ color: C.ink, textDecoration: "none" }}>
                <Img
                  src={`${SITE_URL}/apple-icon.png`}
                  width="28"
                  height="28"
                  alt=""
                  style={{ display: "inline-block", verticalAlign: "middle", borderRadius: 6 }}
                />
                <span style={{ verticalAlign: "middle", fontFamily: C.serif, fontSize: 24, marginLeft: 8 }}>
                  nib
                </span>
              </Link>
            </Section>

            {authorAvatar && (
              <Section className="mt-6">
                <Img
                  src={authorAvatar}
                  width="48"
                  height="48"
                  alt={authorName}
                  className="mx-auto my-0 rounded-full"
                />
              </Section>
            )}

            <Heading className="mx-0 my-4 p-0 text-center text-[26px] font-normal" style={{ fontFamily: C.serif, color: C.ink }}>
              {pieceTitle}
            </Heading>

            <Text className="mb-6 text-center text-[14px] leading-6 text-[#6f6a64]">
              By <strong>{authorName}</strong>
            </Text>

            <Hr className="mx-0 my-6.5 w-full border border-solid border-[#e5dfd5]" />

            <Text className="text-[16px] leading-6.5" style={{ color: C.ink }}>
              {pieceSummary}
            </Text>

            <Section className="mt-8 mb-8 text-center">
              <Link
                href={pieceUrl}
                className="inline-block rounded-lg px-6 py-3 text-center text-[15px] font-semibold no-underline"
                style={{ background: C.primary, color: C.onPrimary }}
              >
                Read on {BRAND_NAME}
              </Link>
            </Section>

            <Hr className="mx-0 my-6.5 w-full border border-solid border-[#e5dfd5]" />

            <Text className="text-center text-[12px] leading-6 text-[#6f6a64]">
              Sent via <strong>{BRAND_NAME}</strong>. You are receiving this because
              you follow {authorName}.
              <br />
              <Link
                href={unsubscribeUrl}
                className="text-[#6f6a64] underline"
              >
                Unsubscribe
              </Link>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export default NibDispatchEmail
