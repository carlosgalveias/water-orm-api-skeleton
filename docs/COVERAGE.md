# Test Coverage Documentation

This document explains how to use and interpret test coverage reports for the worm_api project.

## Overview

The worm_api project uses Node.js's native test coverage feature (available in Node.js 18+) to track code coverage metrics. Coverage reports help identify untested code and ensure adequate test quality.

## Running Coverage Reports

### Full Test Suite Coverage

Run all tests with coverage reporting:

```bash
npm run test:coverage
```

This command:
- Runs all tests (unit and integration)
- Generates coverage statistics for source code directories
- Displays coverage metrics in the terminal
- Shows line-by-line coverage details

### Unit Tests Coverage Only

Run only unit tests with coverage:

```bash
npm run test:unit:coverage
```

### Integration Tests Coverage Only

Run only integration tests with coverage:

```bash
npm run test:integration:coverage
```

### Saving Coverage Reports

To save coverage output to a file for analysis:

```bash
npm run test:coverage:html
```

This creates a `coverage-report.txt` file in the project root with detailed coverage information.

## Coverage Scope

### Included Directories

Coverage is collected from the following source directories:

- **`utils/`** - Utility functions and helpers
- **`controllers/`** - Storage controllers (database and Redis)
- **`routers/`** - Express route handlers
- **`api/`** - API entry points and configuration
- **`models/`** - Database models and schemas
- **`config/`** - Configuration files

### Excluded Directories

The following directories are excluded from coverage:

- **`tests/`** - Test files themselves
- **`node_modules/`** - Third-party dependencies

## Understanding Coverage Metrics

Node.js native coverage provides the following metrics:

### Line Coverage
Percentage of executable code lines that were run during tests.

### Branch Coverage
Percentage of conditional branches (if/else, switch, ternary) that were executed.

### Function Coverage
Percentage of functions that were called during tests.

## Coverage Targets

Based on the QA Action Plan, the project aims for the following coverage thresholds:

| Metric | Target | Priority |
|--------|--------|----------|
| **Lines** | 70% | High |
| **Branches** | 70% | High |
| **Functions** | 70% | High |
| **Statements** | 70% | High |

### Current Coverage Status

See [`plans/coverage-baseline.md`](../plans/coverage-baseline.md) for the current coverage baseline and module-by-module breakdown.

## Module-Specific Coverage

### Well-Tested Modules (>80% coverage)
- Session management (`util-session.js`) - 142 tests
- Encryption utilities (`util-encryption.js`)
- Authentication utilities (`util-auth.js`)
- Permission middleware (`util-permission-middleware.js`)

### Modules Needing Improvement (<70% coverage)
- Database utilities (`util-database.js`)
- Storage controllers (`storage-db.js`, `storage-redis.js`)
- Route handlers (`routers/`)
- API endpoints (`api/`)

## Interpreting Coverage Output

### Terminal Output Format

Node.js coverage reports show:

```
file                  | line % | branch % | funcs % | uncovered lines
----------------------|--------|----------|---------|----------------
utils/util-auth.js    |  85.42 |    78.26 |   90.00 | 45-47, 89-92
```

- **line %**: Percentage of lines executed
- **branch %**: Percentage of branches taken
- **funcs %**: Percentage of functions called
- **uncovered lines**: Line numbers not covered by tests

### Identifying Gaps

1. **Low Branch Coverage**: Indicates missing test cases for conditional logic
2. **Low Line Coverage**: Suggests entire code sections are untested
3. **Low Function Coverage**: Points to unused or untested functions

## Best Practices

### When Writing New Code

1. **Run coverage before and after** to see impact
2. **Aim for 80%+ coverage** on new code
3. **Test edge cases and error paths** to improve branch coverage
4. **Write tests first** (TDD) when possible

### When Improving Coverage

1. **Start with critical paths** (authentication, data access)
2. **Focus on untested functions** first
3. **Add integration tests** for complex workflows
4. **Don't sacrifice test quality** for coverage numbers

### Coverage is Not Everything

Remember that:
- **100% coverage ≠ bug-free code**
- **Quality > Quantity** - meaningful tests are more valuable than coverage percentage
- **Focus on critical paths** first
- **Integration tests** often provide better value than unit test coverage alone

## CI/CD Integration

Coverage reports are automatically generated in the CI/CD pipeline:

- **Pull Requests**: Coverage reports are posted as comments
- **Main Branch**: Coverage trends are tracked over time
- **Build Failures**: Build fails if coverage drops below thresholds

See [`.github/workflows/test-coverage.yml`](../.github/workflows/test-coverage.yml) for CI/CD configuration.

## Troubleshooting

### Coverage Not Showing for a File

**Cause**: File is not imported/required by any tests
**Solution**: Add tests that import the module

### Coverage Numbers Seem Wrong

**Cause**: Tests may not be actually executing the code
**Solution**: Add console.log or debugger to verify test execution

### Coverage Report is Empty

**Cause**: Tests are failing before coverage collection
**Solution**: Run `npm test` first to ensure all tests pass

## Additional Resources

- [Node.js Test Coverage Documentation](https://nodejs.org/api/test.html#collecting-code-coverage)
- [Project Testing Guide](TESTING.md)
- [QA Action Plan](../plans/qa-action-plan.md)
- [Test Coverage Plan](../plans/test-coverage-plan.md)

## Updating This Document

When making significant changes to:
- Coverage tooling
- Coverage targets
- Testing strategy

Please update this document to reflect the changes.

---

Last Updated: 2026-02-07