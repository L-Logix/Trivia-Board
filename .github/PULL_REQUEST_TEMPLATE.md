## Description

<!--
Describe what this PR changes and why. Link to any related issues using "Closes #123" syntax.
Be specific about the problem being solved and the approach taken.
-->

Closes #

## Type of Change

<!-- Check all that apply -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would break existing behavior)
- [ ] Refactor / code cleanup (no functional changes)
- [ ] Documentation / README update
- [ ] CI / build / tooling
- [ ] Dependency update

## Affected Areas

<!-- Which parts of the system does this change touch? -->

- [ ] Server (`src/server/`)
- [ ] CLI / setup (`src/cli/`, `bin/`)
- [ ] Broadcast view (`public/broadcast.html`, `public/js/broadcast.js`, `public/css/broadcast.css`)
- [ ] Dashboard (`public/dashboard.html`, `public/js/dashboard.js`, `public/css/dashboard.css`)
- [ ] Helper screens (`helper-scoring.html`, `helper-board.html`)
- [ ] Audio / visual assets
- [ ] Stress tests / scripts (`scripts/`)
- [ ] Configuration / templates (`config.json`, `trivia-template.csv`)
- [ ] GitHub workflows (`.github/`)

## Testing

<!-- Describe how you tested your changes. Include reproduction steps if applicable. -->

- [ ] `npm run stress` passes
- [ ] `npm run verify:done-reading` passes
- [ ] Manual testing on broadcast + dashboard with a live game
- [ ] Tested with child-host mode enabled/disabled
- [ ] Tested with bonus clues (Daily Double)
- [ ] Tested with championship / final round

## Checklist

- [ ] My code follows the existing project style (no inline comments, concise, consistent naming)
- [ ] I have tested my changes locally with a live game using realistic data
- [ ] My changes do not introduce new console errors or warnings (browser + server)
- [ ] If adding audio/visual elements, they degrade gracefully when assets are not configured
- [ ] This PR does not include any debug code, `console.log`, or leftover comments
- [ ] I have reviewed the diff before opening this PR

## Migration / Deployment Notes

<!--
Any special considerations for deploying this change:
- Does it require regenerating config.json or templates?
- Does it change the database/state schema?
- Should existing game state be cleared?
-->

None.

## Screenshots (if applicable)

<!-- Add screenshots to help reviewers understand UI changes. -->
