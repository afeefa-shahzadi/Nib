# Mycelium FRD

## Document Purpose
This Functional Requirements Document defines what the Mycelium platform must do at the system, module, and user-interaction level. It translates the product vision into concrete functionality across creation, reading, archive intelligence, community, analytics, and monetization.

## Functional Architecture
The platform consists of six major functional domains:

1. Creator Studio.
2. Reader Experience.
3. Archive Intelligence.
4. Community Layer.
5. Monetization Layer.
6. Analytics and Insights.

## Functional Requirements
### 1. Creator Studio
#### 1.1 Structured Editor
- The system shall allow creators to compose content using structured block types.
- The system shall support at minimum text, heading, citation, code, chart, callout, question, and media-reference blocks.
- The system shall preserve semantic metadata for each block so the same block can behave differently in different output modes.
- The system shall allow block rearrangement without content loss.
- The system shall allow inline tagging of claims, evidence, teaching moments, and discussion anchors.

#### 1.2 Mode Preview
- The system shall allow creators to preview the same draft in multiple reader modes.
- The system shall support at minimum skim, standard, expert, teach, and debate modes.
- The system shall preserve the identity of the source draft across all mode transformations.
- The system shall allow creators to configure which blocks appear, collapse, or expand in each mode.

#### 1.3 Publishing Controls
- The system shall allow creators to publish a primary version and optional derivative branches.
- The system shall support draft, scheduled, published, archived, and branched states.
- The system shall support visibility settings such as public, member-only, private, and limited cohort access.

### 2. Reader Experience
#### 2.1 Adaptive Reading Modes
- The system shall render the same content object differently based on selected mode.
- The system shall preserve core argument continuity across modes.
- The system shall allow mode switching without changing the canonical content identity.
- The system shall optionally remember reader mode preference during the current session.

#### 2.2 Reading Interaction
- The system shall support clear navigation between sections, branches, and linked references.
- The system shall allow annotations or note anchors where enabled.
- The system shall provide a clean reading-first interface in standard mode.
- The system shall expose expanded context, evidence, and methodology in expert mode.
- The system shall expose examples, prompts, and exercises in teach mode.

### 3. Archive Intelligence
#### 3.1 Graph Relationships
- The system shall maintain relationships between drafts, published content, branches, themes, products, and discussions.
- The system shall allow visualization of related knowledge objects in a graph or map view.
- The system shall support relationship types such as supports, expands, rebuts, teaches, derives, and bundles.

#### 3.2 Retrieval Assistance
- The system shall surface related prior work while a creator drafts new content.
- The system shall rank suggestions based on relevance, recency, thematic similarity, and creator behavior.
- The system shall allow creators to accept, dismiss, or save suggested links.

### 4. Community Layer
#### 4.1 Structured Discussion
- The system shall allow discussions to attach to entire pieces, sections, or specific claims.
- The system shall support public comments, member discussions, and private cohort prompts.
- The system shall allow creators or moderators to open and close discussion rooms.

#### 4.2 Teaching and Group Use
- The system shall allow creators to mark blocks as prompts, exercises, or checkpoints.
- The system shall allow content to be consumed as guided learning flows.
- The system shall allow member-only teach mode experiences for cohorts.

### 5. Monetization Layer
#### 5.1 Memberships
- The system shall support gated access to posts, branches, and discussion rooms.
- The system shall support tier-aware visibility logic.
- The system shall allow creators to define which modes are premium.

#### 5.2 Bundles and Products
- The system shall allow creators to group related content into bundles.
- The system shall allow the bundle model to include articles, branches, lessons, archives, and discussions.
- The system shall provide metadata for bundle title, description, value proposition, and included objects.

### 6. Analytics and Insights
#### 6.1 Creator Metrics
- The system shall display metrics beyond pageviews, including depth-mode usage, branch conversion, archive reuse, and monetization mix.
- The system shall display engagement events tied to content structure when available.
- The system shall support creator-facing dashboards.

#### 6.2 Understanding Signals
- The system should estimate comprehension-related signals such as repeat reading, expansion into expert mode, or completion of lesson checkpoints.
- The system should expose meaningful summaries rather than raw event floods.

## Permissions Model
### Creator permissions
- Create, edit, branch, publish, archive, gate, and monetize content.

### Editor permissions
- Review, annotate, suggest changes, manage publishing states subject to creator rules.

### Member permissions
- Access gated content according to tier.
- Participate in enabled discussions.
- Save or follow branches where supported.

### Visitor permissions
- Access public content and selected modes.

## Data Entities
Key data entities include:

- Content object.
- Block.
- Branch.
- Mode configuration.
- Graph relationship.
- Bundle.
- Membership tier.
- Discussion room.
- Annotation.
- Insight event.

## Integration Needs
Future implementation may require integrations with:

- Authentication provider.
- Payment provider.
- Email and notification provider.
- Search and indexing system.
- Analytics event pipeline.
- Media and file storage.

## Acceptance Criteria Summary
The MVP concept is functionally successful if a creator can create one structured draft, preview it in several modes, link it to prior knowledge objects, publish it with visible lineage, and expose at least one monetized or discussion-based derivative experience.
