# Security Specification — Private Owner Tutorial

## Data Invariants
1. Only a Google-authenticated user with verified email `tanadaniellemak@gmail.com` (`request.auth.token.email_verified == true`) can read, list, create, update, or delete any document in `/tutorialLessons/{lessonId}`.
2. Every `TutorialLesson` document must contain `lessonId == {lessonId}`, `ownerId == request.auth.uid`, and `ownerEmail == 'tanadaniellemak@gmail.com'`.
3. `createdAt`, `ownerId`, `ownerEmail`, and `lessonId` are immutable after creation; `createdAt` and `updatedAt` must equal `request.time`.
4. All string fields enforce strict length bounds matching `firebase-blueprint.json`, and no undeclared shadow fields are permitted (`hasOnly`).

## Dirty Dozen Attack Vectors (Must All Return PERMISSION_DENIED)
1. Unauthenticated `get` or `list` on `/tutorialLessons`.
2. Authenticated non-owner (`other@gmail.com`) `get` or `list` on `/tutorialLessons`.
3. Unverified email spoofing (`email == 'tanadaniellemak@gmail.com'`, `email_verified == false`).
4. Creating a lesson with `ownerId` spoofed to another UID.
5. Creating a lesson with `ownerEmail` set to another email.
6. Injecting an oversized `lessonId` (> 64 chars) or invalid characters (`../etc`).
7. Injecting an undeclared shadow field (`isAdmin: true`) on `create` or `update`.
8. Forging a client-side `createdAt` or `updatedAt` timestamp not equal to `request.time`.
9. Mutating immutable fields (`ownerId`, `ownerEmail`, `createdAt`, `lessonId`) during `update`.
10. Sending a `notes` payload exceeding 8000 characters (resource exhaustion).
11. Sending invalid field types (e.g., `completed: "yes"` or `orderIndex: "1"`).
12. Accessing any undeclared collection (caught by global deny-all rule).
