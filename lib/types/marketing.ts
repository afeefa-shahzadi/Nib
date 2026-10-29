export type Tier = {
  name: string
  priceRupees: number
  priceRupeesYearly?: number
  priceLabel?: string
  priceSub: string
  priceSubYearly?: string
  discountBadge?: string
  blurb: string
  features: string[]
  cta: string
  ctaTo: string
  accent: boolean
}

export type ModeId = "skim" | "standard" | "expert" | "teach" | "debate"

export type DemoBlock = {
  id: string
  kind: "thesis" | "para" | "evidence" | "counter" | "citation" | "callout"
  text: string
  modes: ModeId[]
}
