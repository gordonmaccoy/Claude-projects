# Room-name joining implementation plan

Scope: step 2.1 only. QR remains supported. Advanced deterrent settings remain previews.

- Create validated readable custom names or silly random names on each new session; normalize Unicode, case and spaces for lookup.
- Persist name/key with session JSON. Unique partial PostgreSQL index reserves names across active sessions, including simultaneous launches. Closed names stop resolving and can be reused. Existing sessions without room names retain QR entry.
- Public POST lookup returns only a relative student join URL, never the professor display capability, roster or answers. Student number/name validation and professor-selected language remain unchanged.
- Wire landing form and custom name toggle. Show room name, site URL and concise instructions at classroom top. Remove room-preview wording, retain advanced deterrent previews.
- Test validation, collisions, persistence, closure, public privacy boundary and actual student joining. Browser-check landing, launch fields and classroom banner. Run regression suite before Public deployment.

Validation: 78 automated tests pass. Room browser covers custom launch, normalized lookup, classroom banner, student identity/join/answer/submit and ended-room error. Existing polish browser passes. Read-only review found no blockers; unique index and response privacy verified. Classroom screenshot visually checked. No advanced deterrent behavior changed.
