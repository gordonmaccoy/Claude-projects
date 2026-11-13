# Launch Options Menu Implementation Plan

Step 1 is the menu only, as requested. Existing launch options remain connected. New room/monitoring controls are explicitly previews and do not change enforcement. Room lookup, unique generated names, classroom room banner, question shuffle, and configurable security enforcement belong to step 2.

- [x] Add landing room-entry preview with an explicit not-connected response; never pretend a student joined.
- [x] Replace launch fields with white/blue switches, optional room/time inputs, corrections on, score on, and collapsed monitoring list with short explanations and specified defaults. Text selection defaults on.
- [x] Keep existing launch payload valid; only active time toggle sends a nonzero duration. Reset defaults on each launch. New preview values are not sent to the server.
- [x] Verify switches, disabled fields, disclosure, defaults, responsive layout, and existing browser launch flow; run syntax and suite checks.

Validation: 77 automated tests passed, dedicated browser integration passed including 320px room-entry containment. Review addressed Korean translations and mobile overflow. Legacy broad browser-smoke could not pass its existing sign-in fixture before reaching the menu; left unchanged.
