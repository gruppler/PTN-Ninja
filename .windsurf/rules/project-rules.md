---
trigger: always_on
---

Never attach vue listeners to a Game object directly, and never mutate a game directly. We must use the vuex output to read from the game, and vuex actions/mutations to mutate the game.

When inserting new i18n strings, put them in the appropriate category if one exists, and insert them in alphabetical order.
