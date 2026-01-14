# Deferred

**Deferred** is an experimental writing and self-reflection interface designed to make thinking feel slow, uncomfortable, and irreversible again.

It is not a productivity tool.  
It is not a journaling app.  
It is not meant to be finished.

Deferred intentionally removes comfort features we take for granted—autosave, undo, skipping, safety nets—and replaces them with time, friction, and commitment. The goal is not better answers, but more honest thinking.

---

## Concept

We are surrounded by systems that optimize for speed, reversibility, and convenience:
- delete buttons
- undo histories
- AI suggestions
- feeds that decide what comes next

Deferred does the opposite.

It creates an environment where:
- writing cannot be skipped
- answers cannot be edited after submission
- time passes even when nothing is typed
- deleting text is a meaningful action, not a harmless one
- leaving early is expected—and measured

The core metric is when and where users leave, not how much they complete.

---

## Experience Principles

- **No skipping**  
  Questions must be answered in sequence. There is no navigation backward.

- **No autosave**  
  Text only becomes real when the user commits by moving forward.

- **Deletion is destructive**  
  Trashed text is recorded, timed, and stored as its own artifact.

- **Time is data**  
  Time spent thinking, pausing, deleting, and abandoning is as important as the final answer.

- **Discomfort escalates**  
  Questions progress from vague and light to personal and invasive, while topics rotate to avoid predictability.

---

## What Is Measured

Deferred treats hesitation as first-class data.

Per session:
- total session duration
- exit point (question where user leaves)

Per question:
- time spent before submission
- time spent on trashed versions
- number of trash actions
- long pauses without typing
- final vs trashed text comparison (when applicable)

The system assumes that leaving is success, not failure.

---

## Question System

- Canonical question set (fixed order for all users)
- Increasing discomfort curve
- Interleaved themes (identity, control, desire, fear, agency)
- Paired questions that reappear later in altered form
- IDs and pair groups designed for longitudinal comparison

The experience is intentionally designed to feel impossible to finish.

---

## Tech Stack (Current)

- **Frontend:** React / Next.js
- **Backend:** Supabase
- **Database:** PostgreSQL (RLS enabled)
- **Auth:** Anonymous / session-based
- **Storage:** Text + metadata only (no AI processing)

The backend is minimal by design. Most logic lives client-side to preserve immediacy and reduce abstraction.

---

## Repository Structure (High Level)

```
/app            → UI, routing, interaction logic
/lib            → Supabase client, helpers
/db             → SQL schemas, indexes, RLS policies
/data           → Question definitions (canonical sets)
/docs           → Concept notes and analysis
```

(Structure may evolve as the project stabilizes.)

---

## Why This Exists

Time is often called our most valuable asset.  
Deferred argues that attention and thought are more valuable—and more endangered.

This project explores what happens when:
- thinking is not optimized
- writing is not safe
- progress is not guaranteed
- technology refuses to help

It is meant as:
- an interaction design experiment
- a critical interface
- a case study for discomfort as a design material

---

## Status

This project is experimental and evolving.  
Expect breaking changes, unfinished edges, and intentional roughness.

Deferred is not meant to scale.  
It is meant to confront.

---

## License

MIT (subject to change if the project evolves into a research artifact)

---

## Author

Leonard A.  
Interaction / Critical Design Project

---

> “This website is meant to waste your time,  
> but it might return a thought.”
