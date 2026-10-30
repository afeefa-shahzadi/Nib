// Core citation type used across piece, blocks, and comments
export interface SourceCitation {
  title: string
  url: string
}

// Piece structure used in feeds
export interface Piece {
  id: string
  title: string
  slug: string
  summary: string | null
  tags: string[] | null
  published_at: string | null
  author: {
    id?: string
    handle: string | null
    display_name: string
    avatar_url: string | null
  } | null
  boosted?: boolean
  cover_image_url?: string | null
}

// Piece detailed structure used in reader
export interface PieceData {
  id: string
  author_id: string
  title: string
  slug: string
  summary: string | null
  canonical_thesis: string | null
  repost_credits_required?: boolean | null
  sponsorship_enabled?: boolean | null
  cover_image_url?: string | null
  is_nsfw?: boolean | null
  is_ai_generated?: boolean | null
  tags?: string[] | null
  published_at?: string | null
  updated_at?: string | null
  prose_only?: boolean | null
  curator_share_enabled?: boolean | null
  price_paise?: number | null
  sources?: SourceCitation[] | null
  source_url?: string | null
}

// Author basic details
export interface AuthorData {
  handle: string
  display_name: string
  bio: string | null
  avatar_url?: string | null
}

// Previous/Next piece navigation
export interface PrevNextPiece {
  slug: string
  title: string
}

// Branch detailed structure
export interface BranchData {
  id: string
  branch_type: string
  visibility: string
  purpose: string | null
  summary: string | null
}

// Mini branch structure used in lists
export interface BranchItem {
  id: string
  parent_object_id: string
  branch_type: string
  visibility: string
  state: string
  purpose: string | null
  summary: string | null
}

// Branch structure specifically used in relationship graph
export interface BranchGraphItem {
  id: string
  parent_object_id: string
  branch_type: string
  purpose: string | null
  summary: string | null
  created_at?: string | null
}

// Outcome-shaped collection / Bundle Item
export interface BundleItem {
  id: string
  title: string
  description: string | null
  outcome: string | null
  price_cents: number
  is_public: boolean
}

// Mini piece structure used in dropdowns / lookups
export interface PieceItem {
  id: string
  title: string
}

// Piece structure specifically used in the relationship graph
export interface PieceGraphItem {
  id: string
  title: string
  slug: string
  reposted_from?: string | null
  author?: { handle: string | null; display_name: string } | null
  published_at?: string | null
}

// Author Dashboard stats structure
export interface AuthorStats {
  revenue30dPaise: number
  supporters: number
  published: number
  drafts: number
  scheduled?: number
  branches: number
  bundles: number
  debateRooms: number
}

// Author Dashboard recent activities
export interface ActivityPiece {
  id: string
  title: string
  status: string
  updated_at?: string
}

export interface ActivitySub {
  id: string
  started_at: string
}

export interface ActivityPurchase {
  id: string
  kind: string
  amount_paise: number
  created_at: string
}

export interface AuthorActivity {
  pieces: ActivityPiece[]
  subs: ActivitySub[]
  purchases: ActivityPurchase[]
}

// Reader Dashboard feeds
export interface ReaderFeed {
  pieces: Piece[]
  empty: boolean
}

// Reader Dashboard follows
export interface ReaderFollows {
  following: Array<
    | {
        id: string
        handle: string | null
        display_name: string
        avatar_url?: string | null
        bio?: string | null
      }
    | undefined
  >
}

// Membership Tiers used in management/cards
export interface TierItem {
  id: string
  name: string
  description: string | null
  price_cents: number
  perks: string[]
  razorpay_plan_id?: string | null
  created_at?: string
  author_id?: string
}

// Author-facing Membership Tier item with supporters count
export interface AuthorTierItem extends TierItem {
  supporters: number
}

// Organization structures
export interface Org {
  id: string
  slug: string
  name: string
  plan: string
  seats: number
  owner_id: string
}

export interface Member {
  id: string
  user_id: string
  role: string
  profile: {
    handle: string | null
    display_name: string
    avatar_url: string | null
  } | null
}

export interface Invite {
  id: string
  email: string
  role: string
  token: string
  accepted_at: string | null
}

// Debate & Room structures
export type AccessMode = "public" | "members" | "tier" | "invite" | "org"

export interface Room {
  id: string
  title: string
  prompt: string | null
  access_mode: AccessMode
  required_tier_id: string | null
  branch_id: string | null
  created_at: string
}

export interface InvitableUser {
  id: string
  handle: string
  display_name: string
  avatar_url: string | null
}

// Notifications structures
export interface Actor {
  handle: string | null
  display_name: string
}

export interface Notif {
  id: string
  type: string
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

// Graph relations
export interface Relationship {
  id: string
  from_object_id: string
  to_object_id: string
  type: string
}

// Collection structures
export interface CollectionRow {
  id: string
  title: string
  description: string | null
  collection_type?: string | null
  piece_count: number
  curator_id: string
  created_at: string
  curator: {
    id: string
    handle: string | null
    display_name: string
    avatar_url: string | null
  } | null
}

// Profile Hover Card representation
export interface ProfileCard {
  id: string
  handle: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  followers: number
  pieces: number
}

// Block annotation note
export interface BlockNote {
  id: string
  block_id: string
  body: string
  user_id: string
  created_at: string
  user: { handle: string; display_name: string } | null
}

// Debate room message
export interface DebateMessage {
  id: string
  user_id: string
  stance: string
  body: string
  created_at: string
  author?: { id?: string; handle: string | null; display_name: string } | null
  block_id?: string | null
}

// Related piece structure used in reader
export interface RelatedPiece {
  id: string
  title: string
  slug: string
  summary: string | null
  handle: string
  type: string
  claps?: number
}

// Debate room structure subset used in reader
export interface DebateRoomItem {
  id: string
  title: string
  prompt: string | null
}

// Piece shape returned by listMyPieces (creator studio draft list)
export interface DraftPiece {
  id: string
  title: string
  slug: string
  status: string
  visibility: string
  updated_at: string
  published_at: string | null
  scheduled_for?: string | null
}
