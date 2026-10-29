# Mycelium Technical Architecture

## Overview
This document outlines a practical technical architecture for evolving the Mycelium concept from prototype into a production-ready web application. The architecture should support a Next.js frontend, structured content models, adaptive rendering, graph relationships, memberships, and future AI-assisted knowledge retrieval.

## Recommended Stack
### Frontend
- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- Component-driven UI architecture.

### Backend
- PostgreSQL with relational and graph-friendly modeling patterns.
- Prisma or Drizzle ORM.
- Supabase or a custom backend service for auth, storage, and database access.

### Supporting systems
- Search index for content retrieval.
- Queue system for background transformations.
- Event pipeline for analytics.
- Object storage for media.

## Application Layers
### 1. Presentation layer
Responsible for creator studio UI, reader modes, settings, dashboards, and monetization surfaces.

### 2. Application logic layer
Responsible for mode transformations, publishing rules, permission enforcement, bundle assembly, and archive retrieval orchestration.

### 3. Data layer
Responsible for content objects, block metadata, relationships, discussions, memberships, analytics summaries, and derived assets.

## Core Domain Model
### Main entities
- User.
- Workspace.
- ContentObject.
- Block.
- Branch.
- ModeProfile.
- Relationship.
- Bundle.
- MembershipTier.
- DiscussionRoom.
- Event.

### Relationship examples
- ContentObject derives from ContentObject.
- Block supports claim.
- Bundle contains ContentObject.
- DiscussionRoom belongs to Block or ContentObject.
- MembershipTier grants access to Branch.

## Rendering Model
The rendering engine should take one canonical content object and apply mode-specific presentation logic. For example:

- Skim mode collapses detail-heavy blocks and highlights claims.
- Standard mode prioritizes clean reading flow.
- Expert mode expands evidence and methodology.
- Teach mode reorganizes examples and checkpoints.
- Debate mode adds discussion surfaces and argument framing.

## Suggested Service Modules
- Content service.
- Transformation service.
- Graph service.
- Discussion service.
- Monetization service.
- Analytics service.
- Search and retrieval service.

## Security Considerations
- Role-based permissions.
- Protected premium content routes.
- Safe rendering for creator-generated content.
- Auditability for content branches and publishing states.
- Moderation controls for discussion spaces.

## Scalability Considerations
- Separate hot read paths from heavy background transformations.
- Cache rendered public mode views where possible.
- Precompute graph summaries and bundle suggestions.
- Use event aggregation for analytics dashboards instead of raw log querying.

## Implementation Phases
### Phase 1
Static frontend and mock data.

### Phase 2
Authenticated creator workspace and persisted drafts.

### Phase 3
Reader modes, graph relationships, discussions, and memberships.

### Phase 4
Transformations, recommendations, bundles, and advanced analytics.
