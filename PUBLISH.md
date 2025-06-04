# Publishing Guide

## Pre-requisites

1. **NPM Account**: You need an npm account with publishing permissions
2. **Authentication**: Login to npm registry:
   ```bash
   npm login
   ```

## Publishing Steps

### 1. Prepare for Release
```bash
# Ensure all dependencies are installed
bun install

# Run type checking
bun run typecheck

# Build the project
bun run build

# Test the built package
node dist/index.js --help
```

### 2. Version Management
```bash
# Update version (patch/minor/major)
npm version patch  # or minor, major

# Or manually edit package.json version
```

### 3. Test Package Creation
```bash
# Dry run to see what will be published
npm pack --dry-run
```

### 4. Publish to NPM
```bash
# Publish to npm registry
npm publish

# For scoped packages (if public)
npm publish --access public
```

## Post-Publishing

### Verify Installation
```bash
# Test npx usage
npx @insomnia-cli/core --help

# Test global installation
npm install -g @insomnia-cli/core
insomnia-cli --help
```

### Update Documentation
- Update README.md with latest version examples
- Create GitHub release with changelog
- Update any external documentation

## Version Strategy

- **Patch** (1.0.x): Bug fixes, minor improvements
- **Minor** (1.x.0): New features, API additions  
- **Major** (x.0.0): Breaking changes, major rewrites

## CI/CD Notes

Consider setting up GitHub Actions for:
- Automated testing on PR
- Automated publishing on release tags
- Cross-platform testing (Node.js versions)

## Troubleshooting

### Common Issues
1. **401 Unauthorized**: Run `npm login` again
2. **Package exists**: Version number needs to be incremented
3. **Scope issues**: Ensure package name matches npm scope

### Rollback
If you need to unpublish (within 24 hours):
```bash
npm unpublish @insomnia-cli/core@1.0.0
```

**Note**: Unpublishing is discouraged and only available for 24 hours after publishing.