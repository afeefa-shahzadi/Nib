# Mycelium Content Model

## Purpose
This document defines the conceptual content model that powers adaptive rendering, branch lineage, graph relationships, and monetization.

## Core Object
The core object is the ContentObject. A ContentObject represents a canonical idea container rather than a flat post.

### ContentObject fields
- ID.
- Title.
- Slug.
- Summary.
- Status.
- Author.
- Canonical thesis.
- Tags.
- Visibility.
- Created date.
- Updated date.
- Mode configurations.

## Block Model
A ContentObject contains ordered blocks.

### Block types
- Paragraph.
- Heading.
- Citation.
- Code.
- Chart.
- Image reference.
- Callout.
- Question.
- Exercise.
- Discussion anchor.
- Audio scene note.

### Block metadata
- Semantic role.
- Display priority.
- Mode visibility.
- Relationship hints.
- Monetization eligibility.
- Teaching relevance.

## Branch Model
A branch is a derivative path of a content object.

### Branch examples
- Audio adaptation.
- Teaching pack.
- Premium update.
- Debate branch.
- Localized edition.

### Branch fields
- Parent content object ID.
- Branch type.
- Branch purpose.
- Visibility.
- State.
- Derived changes summary.

## Relationship Model
Relationships connect content objects, blocks, branches, bundles, and discussions.

### Relationship types
- Supports.
- Expands.
- Rebuts.
- Derives from.
- Teaches.
- Included in bundle.
- Discussed in.

## Bundle Model
A bundle is a monetizable grouping of related knowledge assets.

### Bundle fields
- Title.
- Description.
- Included objects.
- Included branches.
- Price.
- Tier access.
- Outcome statement.

## Discussion Model
Discussions should not be generic only. They may attach to:

- A whole content object.
- A section.
- A specific claim.
- A branch.
- A lesson checkpoint.
