# permission audit

Static audit of frontend route and UI gating versus backend authorization as implemented on 2026-04-07.

Primary references:

- [frontend/src/lib/app-nav.ts](/Users/ethan/dev/cs203-project/frontend/src/lib/app-nav.ts)
- [frontend/src/lib/auth.tsx](/Users/ethan/dev/cs203-project/frontend/src/lib/auth.tsx)
- [backend/src/main/java/com/group7/app/config/SecurityConfig.java](/Users/ethan/dev/cs203-project/backend/src/main/java/com/group7/app/config/SecurityConfig.java)
- [backend/src/main/java/com/group7/app/lesson/service/LessonService.java](/Users/ethan/dev/cs203-project/backend/src/main/java/com/group7/app/lesson/service/LessonService.java)

## mismatch summary

| severity | mismatch | frontend | backend | impact |
| --- | --- | --- | --- | --- |
| high | learners can open authoring routes directly | `/add` only requires onboarding, not role; `/add-lesson` allows any onboarded user | learners cannot `POST /api/contents` and cannot `POST /api/lessons` | learners hit routes and forms they cannot actually use |
| medium | contributors are redirected to moderator review page after lesson submit | contributor flow navigates to `/review` after submit | `/review` ui and backend pending/review endpoints are moderator/admin only | successful contributor submit lands on access denied |
| medium | forum moderation controls are missing in ui | delete buttons only show for owner | moderator/admin can delete any question or answer | moderation exists in backend but is not exposed in ui |
| medium | forum posting and voting gate is frontend-only | `canPost` requires auth plus display name | backend only requires authentication for forum write and vote actions | users blocked in ui can still call api directly |
| low | dev role endpoint is broader than frontend dev ui | profile ui can switch to learner, contributor, and optionally admin, but not moderator | dev endpoint can set any enum role when enabled, including moderator | frontend and backend dev-role behavior do not match |

## frontend matrix

| surface | route gate | hidden in nav | ui behavior by role |
| --- | --- | --- | --- |
| `/lessons` | auth; learners need onboarding, contributor/mod/admin bypass onboarding | no | learner gets normal locked progression. contributor/mod/admin get all-unlocked learning flow. mod/admin get `Units` admin tab. contributor/mod/admin get `Add Lesson` button |
| `/add` | onboarding only | yes for learner; visible for contributor/mod/admin | page itself is reachable by any onboarded user. both add lingo and add lesson forms render regardless of role |
| `/add-lesson` | auth; learners need onboarding, contributor/mod/admin bypass onboarding | not in nav | reachable directly. no role check in page |
| `/dictionary` | onboarding only | no | add lingo button for contributor/mod/admin. delete button for mod/admin. voting visible to any signed-in onboarded user |
| `/review` | onboarding only | yes except mod/admin | direct url works for anyone onboarded, but page shows access denied unless mod/admin |
| `/forum` | public | no | read is public. ask/post/vote only if authenticated and has display name. delete buttons only for owner |
| `/dashboard` | onboarding only | no | visible to all roles; page is contributor-oriented but not role-restricted |
| `/revise` | onboarding only | no | no role-specific ui |
| `/leaderboard` | onboarding only | no | no role-specific ui |
| `/profile` | auth only | no | normal role switch supports learner and contributor; admin only with dev flag; no moderator option |

## backend matrix

| api surface | learner | contributor | moderator | admin | notes |
| --- | --- | --- | --- | --- | --- |
| `GET /api/users/me` | yes | yes | yes | yes | auth required |
| `PATCH /api/users/me` | yes | yes | yes | yes | normal role change only supports learner and contributor intent |
| `POST /api/users/me/dev-role` | dev only | dev only | dev only | dev only | if enabled, can set any enum role |
| `GET /api/contents/approved` | public | public | public | public | public approved dictionary |
| `POST /api/contents` | no | yes | yes | yes | moderator and admin auto-approve on submit |
| `GET /api/contents/pending`, `PUT /api/contents/{id}/review`, `DELETE /api/contents/{id}` | no | no | yes | yes | review and delete aligned to moderator/admin |
| content votes and `GET /api/contents/approved-with-votes`, `GET /api/contents/me` | yes | yes | yes | yes | auth only, no role gate |
| `GET /api/forum/**` | public | public | public | public | forum read is public |
| forum post, answer, vote, media sign url | yes | yes | yes | yes | auth only, no role gate |
| forum delete question and answer | own | own | any | any | owner or moderator/admin |
| `GET /api/units`, `GET /api/lessons` | approved only | approved only | all | all | contributor cannot list all pending or draft lessons |
| `GET /api/lessons/{id}`, `GET /api/lessons/{id}/content` | approved only | approved plus own non-approved | all | all | owner can view own non-approved lesson |
| `POST /api/lessons` | no | yes | yes | yes | lesson drafts can be created by contributor, moderator, and admin |
| lesson status transitions | no | own submit and own rejected to draft | review any; admin-style access | review any; admin-style access | approval and rejection are moderator/admin only |
| lesson metadata and step crud | no | own draft or rejected only | any; approved edit allowed | any; approved edit allowed | approved lesson edits are moderator/admin only |
| `POST`, `PATCH`, `DELETE /api/units` | no | no | yes | yes | unit management is moderator/admin |
| `POST /api/vocab` | yes | yes | yes | yes | auth only, no role gate |
| attempts, progress, revise, vocab-memory | yes | yes | yes | yes | auth only; attempts are effectively for approved lessons and own attempts |
| `GET /api/leaderboard` | yes | yes | yes | yes | auth only |

## notable code references

- nav hides add and review links by role: [frontend/src/lib/app-nav.ts](/Users/ethan/dev/cs203-project/frontend/src/lib/app-nav.ts#L33)
- root shell filters nav items by `item.roles`: [frontend/src/routes/__root.tsx](/Users/ethan/dev/cs203-project/frontend/src/routes/__root.tsx#L37)
- onboarding-only route guard: [frontend/src/lib/auth.tsx](/Users/ethan/dev/cs203-project/frontend/src/lib/auth.tsx#L72)
- contributor-or-onboarded guard: [frontend/src/lib/auth.tsx](/Users/ethan/dev/cs203-project/frontend/src/lib/auth.tsx#L104)
- add page is onboarding-gated, not role-gated: [frontend/src/routes/add.tsx](/Users/ethan/dev/cs203-project/frontend/src/routes/add.tsx#L21)
- review route is onboarding-gated, with role check done inside page: [frontend/src/routes/review.tsx](/Users/ethan/dev/cs203-project/frontend/src/routes/review.tsx#L83), [frontend/src/routes/review.tsx](/Users/ethan/dev/cs203-project/frontend/src/routes/review.tsx#L752)
- lesson ui treats moderator as contributor for authoring access: [frontend/src/routes/lessons.tsx](/Users/ethan/dev/cs203-project/frontend/src/routes/lessons.tsx#L38), [frontend/src/routes/dictionary.tsx](/Users/ethan/dev/cs203-project/frontend/src/routes/dictionary.tsx#L91)
- contributor lesson submit redirects to review: [frontend/src/components/lesson-quiz-forms.tsx](/Users/ethan/dev/cs203-project/frontend/src/components/lesson-quiz-forms.tsx#L568)
- forum ui only shows delete controls for owner: [frontend/src/routes/forum.tsx](/Users/ethan/dev/cs203-project/frontend/src/routes/forum.tsx#L635), [frontend/src/routes/forum.tsx](/Users/ethan/dev/cs203-project/frontend/src/routes/forum.tsx#L834)
- backend content rules in security config: [backend/src/main/java/com/group7/app/config/SecurityConfig.java](/Users/ethan/dev/cs203-project/backend/src/main/java/com/group7/app/config/SecurityConfig.java#L43)
- backend lesson role checks: [backend/src/main/java/com/group7/app/lesson/service/LessonService.java](/Users/ethan/dev/cs203-project/backend/src/main/java/com/group7/app/lesson/service/LessonService.java#L53), [backend/src/main/java/com/group7/app/lesson/service/LessonService.java](/Users/ethan/dev/cs203-project/backend/src/main/java/com/group7/app/lesson/service/LessonService.java#L330), [backend/src/main/java/com/group7/app/lesson/service/LessonService.java](/Users/ethan/dev/cs203-project/backend/src/main/java/com/group7/app/lesson/service/LessonService.java#L500)
- backend forum delete permissions: [backend/src/main/java/com/group7/app/forum/controller/ForumController.java](/Users/ethan/dev/cs203-project/backend/src/main/java/com/group7/app/forum/controller/ForumController.java#L88), [backend/src/main/java/com/group7/app/forum/controller/ForumController.java](/Users/ethan/dev/cs203-project/backend/src/main/java/com/group7/app/forum/controller/ForumController.java#L135)
- backend debug deletion endpoint: [backend/src/main/java/com/group7/app/lesson/controller/DebugController.java](/Users/ethan/dev/cs203-project/backend/src/main/java/com/group7/app/lesson/controller/DebugController.java#L27)

## recommended follow-up

1. add explicit frontend role guards for `/add` and `/add-lesson`
2. decide whether moderators should be able to create lessons, then align both frontend and backend
3. stop redirecting contributors to `/review` after lesson submission
4. expose moderator and admin forum moderation controls if that permission is intended
5. lock down or remove `/api/debug/**`
