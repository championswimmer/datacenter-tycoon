# Project Skills

This directory holds project-local agent skills for Datacenter Tycoon, following the [SKILL.md](https://agentskills.io/specification) format.

## Layout

```
.agents/skills/
├── README.md
└── <skill-name>/
    ├── SKILL.md          # required: YAML frontmatter + markdown instructions
    ├── scripts/          # optional: helper scripts
    ├── references/       # optional: reference docs
    └── assets/           # optional: templates, fixtures
```

## SKILL.md Format

Each skill is a directory containing a `SKILL.md` with YAML frontmatter:

```markdown
---
name: skill-name              # lowercase, hyphen-separated
description: Short description of what the skill does and *when an agent should use it*.
version: 0.1.0                # optional
license: MIT                  # optional
---

# Skill Name

## Overview
What this skill does.

## When to Use
Triggers / scenarios where the agent should activate this skill.

## Instructions
Step-by-step guidance for the agent.
```

The `description` is the most important field — agents match it against the user's task to decide whether to load the skill.

## Adding a New Skill

1. Create `.agents/skills/<your-skill-name>/SKILL.md`.
2. Fill in frontmatter with a clear, trigger-rich `description`.
3. Add scripts/references/assets subdirs as needed.
