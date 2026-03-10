> **CleanSlice Studio**
> (You can rename it later.)

---

# 🧬 CleanSlice Studio

> A visual slice-based application builder for Clean Architecture projects.
> Build features as independent slices. Attach them to your app. Generate production-ready code.

---

## 🚀 What Is This?

CleanSlice Studio is a **visual application generator** designed around Clean Architecture and feature slices.

Instead of generating entire projects from prompts, you:

1. Start with a base stack (e.g. Nuxt + NestJS)
2. Create or import feature slices
3. Visually attach slices to your application
4. Generate structured, production-ready code

Every slice represents a **complete feature boundary**:

* API endpoints
* UI pages/components
* Data models
* Policies
* Events
* Tests

You build systems by composing slices.

---

# 🎯 Why This Exists

Traditional AI app generators:

* Dump uncontrolled code
* Mix concerns
* Don’t respect architecture
* Hard to evolve

CleanSlice Studio:

* Enforces boundaries
* Respects Clean Architecture
* Keeps generation deterministic
* Works with real repositories
* Supports regeneration safely

It is not a toy builder.
It is a **feature compiler**.

---

# 🏗 Architecture Philosophy

This project is built around:

* Feature-first architecture
* Vertical slices
* Clear ownership boundaries
* Regenerable code
* Diff-based generation
* Deterministic outputs

Each slice is:

```
slice/
 ├── api/
 ├── ui/
 ├── domain/
 ├── policies/
 ├── events/
 └── tests/
```

A slice is self-contained and attachable.

---

# 🖥 Core Experience

## 1️⃣ Visual Graph Builder

The workspace is a zoomable node canvas.

Center:

```
Application Node
```

Around it:

```
Auth Slice
Users Slice
Payments Slice
Admin Slice
Custom Slices
```

You can:

* Drag slices
* Attach them to the app
* View dependencies
* Inspect API contracts
* Preview UI
* Detect conflicts

Edges indicate:

* Dependency
* Compatibility
* Conflicts

---

## 2️⃣ Slice Editor

Each slice contains structured configuration:

* Goal
* UI
* API
* Data
* Policies
* Events
* Tests

A slice becomes “Ready” when:

* Required fields are complete
* No conflicts exist
* Dependencies resolved

---

## 3️⃣ Code Generation Engine

Click:

```
Generate Changes
```

The system:

* Produces file diffs
* Creates API modules
* Adds migrations
* Updates router
* Generates typed client
* Creates UI pages
* Generates tests

No blind overwrite.

Everything is previewable before apply.

---

# 🧱 Technology Stack

## Frontend (Studio)

* Nuxt 3
* Vue Flow (node canvas engine)
* Tailwind CSS
* shadcn-vue
* Pinia (state management)

## Backend (Generator Engine)

* Node.js
* AST manipulation (ts-morph)
* Template engine
* Deterministic code synthesis
* Slice manifest system

## Target Stack (Generated Apps)

Default:

* NestJS (API)
* Nuxt 3 (App)
* Prisma / Postgres (optional)

---

# 🧠 How It Works Internally

Each slice has:

```ts
SliceManifest {
  name: string
  type: 'api' | 'ui' | 'full'
  dependencies: string[]
  endpoints: EndpointDefinition[]
  models: ModelDefinition[]
  policies: PolicyDefinition[]
  events: EventDefinition[]
}
```

Generation pipeline:

1. Validate graph
2. Resolve dependency tree
3. Build unified model map
4. Detect naming conflicts
5. Generate AST changes
6. Produce file diff
7. Apply or export patch

---

# 📦 Project Structure

```
cleanslice-studio/
│
├── apps/
│   ├── studio/         # Nuxt visual builder
│   └── generator/      # Code generation engine
│
├── packages/
│   ├── slice-schema/   # Slice manifest definitions
│   ├── templates/      # Code templates
│   └── compiler/       # AST + diff engine
│
└── examples/
    └── sample-project/
```

---

# 🔌 Predefined Slices

Out of the box:

* Auth
* Users
* Teams
* Admin
* Payments
* Audit Log
* Notifications

Each is configurable before generation.

---

# 🔄 Import Existing Repository

You can import an existing CleanSlice project.

The system:

* Scans directory structure
* Detects slices
* Builds visual graph
* Reverse-engineers slice metadata

This makes it a **Slice IDE**, not just a generator.

---

# 🛡 Regeneration Safety

Generated code includes:

```ts
// <cleanslice:protected>
// manual edits safe here
// </cleanslice:protected>
```

The generator:

* Preserves manual edits
* Warns on destructive overwrite
* Shows diff preview

---

# 🧩 Dependency Management

Slices can declare:

```ts
dependencies: ['users', 'auth']
```

Graph engine ensures:

* No circular dependencies
* No duplicate ownership of models
* No conflicting routes

Edge colors:

* Green → OK
* Yellow → Missing dependency
* Red → Conflict

---

# 🧪 Testing Strategy

Every slice can define:

* Acceptance checklist
* API contract tests
* Integration tests

Generated output includes:

```
users.slice.spec.ts
```

---

# 🧭 Roadmap

### Phase 1

* Basic slice creation
* Visual attach
* API generation
* Diff preview

### Phase 2

* UI preview inside node
* Import repo support
* Marketplace slices

### Phase 3

* Multi-app orchestration
* Event-driven slice linking
* Microservice export

---

# 🎨 Design Principles

* Minimal cognitive load
* Architecture-first
* Deterministic generation
* Visual clarity
* No magic

---

# 🧠 Who Is This For?

* SaaS founders
* Architecture-focused teams
* AI-first developers
* Enterprise internal tooling teams
* Clean Architecture advocates

---

# 💡 Example Workflow

1. Create new workspace
2. Choose: Nuxt + Nest
3. Add Users slice
4. Add Auth slice
5. Attach slices
6. Resolve dependency
7. Click Generate
8. Review diff
9. Apply
10. Run app

---

# 🤖 AI Agent Setup (Claude Code)

Install the CleanSlice MCP so your AI agent knows the architecture:

```sh
claude mcp add --scope user --transport http cleanslice https://mcp.cleanslice.org/mcp
```

**Tip: enforce MCP usage with CLAUDE.md**

To make sure Claude Code always consults the CleanSlice MCP **before** writing any code, add the following to your project's `CLAUDE.md`:

```markdown
## CleanSlice MCP — Required

Before writing or modifying any code you MUST consult the CleanSlice MCP:

1. Call `get-started` to load the core architecture rules.
2. Call `list-categories` to see available documentation areas.
3. Call `search` with at least 2 task-relevant queries covering:
   (a) core implementation details for the feature you are building,
   (b) edge cases, constraints, or standards that apply.

Do NOT guess conventions — always verify against MCP results first.
```

**Optional: add a Stop hook as a safety net**

To catch cases where the agent skips the MCP despite the `CLAUDE.md` instruction, add this to `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "agent",
            "timeout": 180,
            "prompt": "You are a verification subagent. Your job: ensure the main Claude Code agent used the `cleanslice` MCP knowledge sufficiently and did not guess.\n\nContext JSON:\n$ARGUMENTS\n\nVerification requirements:\n1) Identify what the user asked for (deliverables + constraints) from the conversation/transcript in $ARGUMENTS.\n2) Verify the agent consulted the `cleanslice` MCP server for relevant knowledge BEFORE finalizing:\n   - Must call `cleanslice` \"get-started\" at least once (or equivalent) to confirm the server's purpose and usage.\n   - Must call \"list-categories\" to understand the available knowledge areas.\n   - Must call \"search\" with task-relevant queries (at least 2 searches) covering: (a) core implementation details, (b) edge cases / constraints.\n3) Validate coverage:\n   - If any required category is relevant but not checked, fail.\n   - If answers include specifics that are not supported by MCP results, fail.\n4) Output STRICT JSON only:\n   - If everything is verified: {\"ok\": true}\n   - If anything is missing/unsupported: {\"ok\": false, \"reason\": \"What is missing + exact MCP calls the main agent must run next (e.g., run list-categories, then search for X/Y, then update the solution).\"}\n\nImportant:\n- `cleanslice` tools will appear as MCP tools. Use whatever exact tool names are available in this environment (they follow the mcp__<server>__<tool> naming pattern).\n- Do not allow stopping until MCP-backed evidence is sufficient."
          }
        ]
      }
    ]
  }
}
```

---

# 📜 License

MIT (or commercial license)

---

# 🧬 Vision

CleanSlice Studio is not a page builder.
It is not a no-code tool.

It is:

> A visual architecture compiler.

You don’t generate apps.
You compose systems.