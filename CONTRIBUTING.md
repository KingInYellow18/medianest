# Contributing to MediaNest

First off, thank you for considering contributing to MediaNest! 

## Code of Conduct
This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs
- Use the bug report template
- Include as much detail as possible
- Include steps to reproduce

### Suggesting Features
- Use the feature request template
- Explain the problem it solves
- Consider the project scope

### Pull Requests
1. Fork the repo and create your branch from `develop`
2. If you've added code that should be tested, add tests
3. Ensure the test suite passes
4. Make sure your code lints
5. Issue that pull request!

## Development Process
1. Clone the repository
2. Install dependencies: `npm install` (this sets up Git hooks automatically)
3. Start development: `npm run dev`
4. Create a feature branch: `git checkout -b feature/your-feature`
5. Make your changes
6. Run tests: `npm test`
7. Commit your changes (pre-commit hooks will run ESLint automatically)
8. Push and create a PR

## Style Guide
- Follow the ESLint configuration
- Write meaningful commit messages
- Add JSDoc comments for public APIs

## Git Hooks
This project uses `simple-git-hooks` to maintain code quality:
- **Pre-commit**: Runs ESLint on staged TypeScript/JavaScript files
- Hooks are automatically installed when you run `npm install`
- To manually update hooks: `npx simple-git-hooks`

## Testing
- Write tests for new features
- Maintain test coverage above 70%
- Run `npm test` before committing

## Questions?
Feel free to open an issue with your question!