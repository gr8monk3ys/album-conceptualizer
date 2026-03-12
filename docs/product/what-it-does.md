# What This Repo Does

Album Conceptualizer is a concept-album workspace. It helps creators turn an idea into a coherent multi-track project with structure, creative memory, collaboration, and export handoff.

It is not just a Python library and it is not just a website. It is a multi-surface product with shared domain logic.

## Primary User Value

The product is designed to answer a harder question than "generate a single song":

How do you keep an entire album coherent across themes, characters, motifs, track arcs, lyrics, harmony, collaboration, and export?

That is the wedge.

## Main Product Surfaces

### 1. Next.js Web App

The web app is the primary shipped product.

It currently supports:

- guided album creation
- workspace and album dashboards
- album bible generation and editing
- Studio editing for songs, sections, lyrics, and chord progressions
- comments, tasks, versions, and notifications
- export through the Python engine
- Discover, sharing, public publishing, and remix or fork flows
- billing, credits, daily challenges, and analytics

### 2. Python Engine API

The Python API powers:

- album CRUD
- bible and theory endpoints
- export generation
- identity and billing support
- experience toolkit endpoints
- optional AI and RAG features when installed

### 3. Legacy Gradio UI

The Gradio app still matters for:

- local smoke coverage
- parity checks
- lightweight demos
- workflows that use the Python package directly

## Core User Flows

### Create

Users start from a concept, genre direction, and track count, then save a first album scaffold.

### Refine

Users fill out:

- album metadata
- songs and sections
- lyrics drafts
- chord progressions
- concept summary
- album bible data

### Collaborate

Users can:

- leave comments
- assign or complete tasks
- review versions
- track notifications

### Export

Users can export handoff artifacts such as:

- JSON
- MIDI
- ChordPro
- MusicXML

### Publish And Remix

Users can publish albums into Discover, share projects publicly, and fork or remix public work into their own workspace.

## Strongest Areas Today

- album-level coherence
- structured project editing
- export and handoff workflows
- collaboration and workflow primitives
- local E2E quality

## What It Is Not

Album Conceptualizer is not currently a direct Suno or Udio replacement.

It does not natively compete on:

- prompt-to-finished commercial audio generation
- deep waveform-first editing
- audio-level voice cloning or persona control

Its current strength is the before-the-DAW layer:

- album planning
- conceptual consistency
- structured lyrics and harmony work
- creative workflow and collaboration
- export into downstream tools

## Who It Is For

Best fit today:

- songwriters building multi-track projects
- producers planning album arcs before full production
- indie artists and bands who care about thematic coherence
- small creative teams who need a shared workspace

Poor fit today:

- users who only want one-click finished songs
- users who expect a full DAW replacement

## Product Positioning

The most accurate positioning is:

Album Conceptualizer is the operating system for coherent concept albums.

That is different from:

- a general AI music generator
- a standalone notation tool
- a pure export library
- a social music app

## Practical Summary

If someone asks what this repo does right now, the short answer is:

It gives you a structured workspace to create, refine, collaborate on, export, publish, and remix concept-album blueprints, with a Python engine behind the scenes for export and supporting APIs.
