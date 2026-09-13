# PUB Git Stage Closure Rule

**Effective:** 2026-09-13
**Scope:** This repository
**Status:** Mandatory operational rule

A development stage may be declared **CLOSED / COMPLETE / PASS** only after: implementation complete; required tests/gates pass; working tree clean; intended changes committed; commit published to the official remote; local HEAD verified against the intended remote branch; and remote state verified after publication.

A local commit alone does **not** close a stage.

Required sequence: `IMPLEMENT → TEST → COMMIT → PUSH → VERIFY REMOTE → DECLARE CLOSED → NEXT STAGE`

If publication is intentionally withheld for security, review, or another explicit reason, record **IMPLEMENTED LOCALLY / NOT YET PUBLISHED** and do not call the stage CLOSED or COMPLETE.

Before starting a new stage, verify that GitHub reflects the state declared complete. GitHub is the source of truth; local state is provisional until synchronized and remotely verified.
