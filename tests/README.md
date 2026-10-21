# PTN Ninja E2E Tests

End-to-end tests for PTN Ninja using Playwright.

## Setup

Install test dependencies:

```bash
# From project root
yarn test:install

# Or from tests directory
cd tests
npm install
npx playwright install chromium
```

## Running Tests

### From Project Root

```bash
# Run all tests (headless)
yarn test

# Run tests with UI
yarn test:ui

# Run tests in headed mode (see browser)
yarn test:headed
```

### From Tests Directory

```bash
cd tests

# Run all tests
npm test

# Run with Playwright UI
npm run test:ui

# Run in headed mode
npm run test:headed

# Run in debug mode
npm run test:debug

# View test report
npm run report
```

## Test Structure

```
tests/
├── playwright.config.js   # Playwright configuration
├── package.json           # Test dependencies
├── README.md              # This file
└── e2e/
    └── branch-promotion.spec.js  # Branch promotion tests
```

## Branch Promotion Tests

The `branch-promotion.spec.js` file contains comprehensive tests for branch promotion operations:

- **T1**: Promote branch to main (simple, top-level)
- **T2**: Promote branch among siblings (promoteBranch, 3+ siblings)
- **T3**: Promote branch while currently on mainline
- **T4**: Promote nested branch (depth 2)
- **T5**: Promote branch with NOP (--) at branch start
- **T7**: Promote branch with annotations/eval markers
- **T8**: Promote branch with notes attached
- **T9**: Repeat promotions (stability)
- **T10**: Full regression (large PTN with complex branching)
- **T11**: Promote among 3+ siblings while on that branch
- **T12**: Promote among 3+ siblings while on mainline

### Test Invariants

Each test verifies:

- **Valid PTN**: Game validates after promotion
- **No ply loss**: Ply count unchanged
- **Tokens preserved**: Expected move tokens still present in PTN
- **Board state preserved**: TPS unchanged where applicable

## Development

### Adding New Tests

1. Add test fixtures (PTN strings) to `PTN_FIXTURES` object
2. Add test case using `test()` function
3. Use helper functions:
   - `loadPTN(page, ptn)` - Load PTN into the app
   - `getGameState(page)` - Get current game state
   - `goToBranchEnd(page, branch)` - Navigate to branch end
   - `goToMainEnd(page)` - Navigate to main branch end
   - `validateGame(page)` - Validate game PTN

### Browser Console Runner

In development builds, you can also run tests via the browser console:

```js
// Run all tests
window.branchPromotionTests.runAll();

// List available tests
window.branchPromotionTests.list();

// Run a single test
window.branchPromotionTests.runCase("T10");
```

## CI Integration

The tests are configured to work in CI environments:

- Uses single worker in CI
- Retries failed tests twice
- Generates HTML report
- Takes screenshots on failure
