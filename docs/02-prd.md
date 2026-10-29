# Mycelium PRD

## Document Purpose
This Product Requirements Document defines the business case, product goals, user needs, scope, and release priorities for Mycelium, an adaptive blogging and publishing platform concept built around structured content, multimodal publishing, archive intelligence, and monetization layers.[web:1][web:3]

## Problem Statement
Modern creators often manage publishing through fragmented stacks: one tool for websites, another for newsletters, another for memberships, another for analytics, and often another for community or courses. Existing platforms provide strong capabilities in selected areas, but they still separate core publishing, audience, and product workflows in ways that create operational overhead and duplicated effort.[web:1][web:3]

At the same time, high-quality editorial websites increasingly use interaction, structure, and narrative presentation to shape comprehension, which raises reader expectations beyond static blog templates.[web:14][web:18][web:11]

## Opportunity
There is an opportunity to build a platform where a single content object can support many delivery experiences and business outcomes. This is especially valuable for educators, technical writers, researchers, and knowledge businesses whose work naturally spans articles, explainers, lessons, audio, communities, and archives.[web:3][web:14]

## Vision Statement
Mycelium will become a creator operating system for knowledge publishing. It will let creators author once, adapt content by reader depth and use case, retrieve related work automatically, maintain visible lineage across versions, and monetize both content and connected knowledge structures.

## Goals
### Business goals
- Differentiate from standard blogging and newsletter products through a new publishing model.
- Increase creator retention by making the archive and monetization system more valuable over time.
- Expand monetization options beyond subscriptions.
- Position the platform as premium editorial infrastructure.

### User goals
- Reduce tool fragmentation.
- Reduce duplicated writing and formatting work.
- Make archive content reusable.
- Support multiple audience levels from one draft.
- Build audience relationships without exporting users to disconnected systems.

## Non-goals
The initial concept is not intended to be:

- A general-purpose social network.
- A marketplace for unrelated third-party content.
- A no-code website builder focused primarily on template customization.
- A learning management system replacement in its first version.
- A document collaboration suite competing directly with office tools.

## User Personas
### Persona 1: Independent essayist
Publishes thoughtful long-form writing, wants elegant presentation, memberships, and archive value.

### Persona 2: Technical educator
Publishes explainers, workshops, and code-heavy content, and needs one source draft to serve both readers and students.

### Persona 3: Research-driven analyst
Needs citations, versions, updates, and expert-level expansion layers for serious readers.

### Persona 4: Knowledge entrepreneur
Wants to transform archives into premium bundles, learning paths, and subscriber-only branches.

## User Stories
- As a creator, I want to write one draft that can become multiple outputs so I do not manually duplicate work.
- As a reader, I want to choose my depth level so I can consume the same idea according to my time and intent.
- As a creator, I want older relevant notes to surface while writing so my archive becomes useful.
- As a member, I want discussions tied to exact ideas so conversations stay meaningful.
- As a creator, I want to sell bundles of related content so monetization is not limited to subscriptions.
- As an editor, I want visible lineage between versions so updates and derivatives remain understandable.

## Functional Scope
### In scope for MVP concept
- Creator dashboard.
- Structured editor.
- Reader mode switching.
- Knowledge graph view.
- Branch lineage display.
- Membership and monetization surfaces.
- Basic analytics model.

### Out of scope for MVP concept
- Native payment gateway integrations.
- AI-generated media production at scale.
- Real-time multiplayer editing.
- Full enterprise permissions matrix.
- Marketplace and ad network tooling.

## Feature Prioritization
| Priority | Feature | Reason |
|---|---|---|
| P0 | Structured content editor | Core platform foundation |
| P0 | Reader depth modes | Main product differentiator |
| P0 | Knowledge graph retrieval | Strategic archive value |
| P0 | Branch lineage model | Differentiated publishing logic |
| P1 | Membership rooms | Strong monetization and community fit |
| P1 | Bundle builder | Extends value beyond subscriptions |
| P1 | Insight-oriented analytics | Supports creator decisions |
| P2 | Audio/script mode automation | Strong but secondary multiplier |
| P2 | Classroom exports | Useful for educators but not required for first release |

## User Journey
### Creator journey
1. Creator starts a draft.
2. The editor suggests related existing content and knowledge graph links.
3. The creator builds content with structured blocks.
4. The creator previews how the content appears in skim, standard, expert, and teach modes.
5. The creator publishes the base piece.
6. The creator optionally opens debate mode, member-only branches, or bundle packaging.

### Reader journey
1. Reader arrives through search, social, or direct follow.
2. Reader enters skim or standard mode by default.
3. Reader deepens into expert or teach mode if motivated.
4. Reader joins discussion, membership, or bundle purchase flows if interested.

## Success Metrics
- Percentage of drafts published in more than one mode.
- Number of archive links suggested and accepted during writing.
- Reader movement between modes.
- Member participation rate in structured discussions.
- Percentage of revenue from bundles and premium branches.
- Creator retention over time due to accumulated archive utility.

## Risks
- Feature complexity may overwhelm first-time users.
- A new content model may require strong onboarding.
- Readers may not immediately understand depth mode switching.
- Archive intelligence may require careful ranking logic to stay useful.
- Monetization surfaces could become cluttered if not designed with restraint.

## Release Strategy
### Phase 1
Concept demo and narrative prototype.

### Phase 2
Frontend application with mock data, route-level pages, and interaction model.

### Phase 3
Backend integration, persistence, accounts, and content lifecycle.

### Phase 4
Payments, memberships, analytics, and creator onboarding.
