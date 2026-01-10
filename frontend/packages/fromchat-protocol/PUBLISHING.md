# Publishing FromChat Protocol

This guide explains how to publish the `@fromchat/protocol` package to npm or GitHub Packages.

## Prerequisites

1. **npm account**: Create one at [npmjs.com](https://www.npmjs.com/signup)
2. **GitHub account**: For GitHub Packages
3. **Node.js**: Version 18 or higher

## Publishing to npm

### Important: Scoped Package Setup

The package uses the `@fromchat` scope. You have two options:

**Option A: Create an npm organization (Recommended)**
1. Go to [npmjs.com/org/create](https://www.npmjs.com/org/create)
2. Create an organization named `fromchat`
3. Add yourself as a member
4. Then proceed with publishing below

**Option B: Use unscoped package name**
If you prefer not to create an organization, change the package name in `package.json`:
```json
{
  "name": "fromchat-protocol"  // Remove the @fromchat/ scope
}
```
Then update all imports in your codebase from `@fromchat/protocol` to `fromchat-protocol`.

### 1. Build the package

```bash
cd frontend/packages/fromchat-protocol
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### 2. Login to npm

```bash
npm login
```

Enter your npm username, password, and email.

### 3. Publish

**If using scoped package (`@fromchat/protocol`):**
```bash
npm publish --access public
```

**If using unscoped package (`fromchat-protocol`):**
```bash
npm publish
```

The `--access public` flag is required for scoped packages (packages starting with `@`).

### 4. Verify

Check your package at: `https://www.npmjs.com/package/@fromchat/protocol`

### 5. Update version for future releases

```bash
# Patch version (1.0.0 -> 1.0.1)
npm version patch

# Minor version (1.0.0 -> 1.1.0)
npm version minor

# Major version (1.0.0 -> 2.0.0)
npm version major

# Then publish
npm publish --access public
```

## Publishing to GitHub Packages

### 1. Create a GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate a new token with `write:packages` and `read:packages` permissions
3. Save the token securely

### 2. Configure npm to use GitHub Packages

Create or edit `~/.npmrc`:

```
@fromchat:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Or add to `package.json`:

```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

### 3. Update package.json

Update the repository URL to match your GitHub repository:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_USERNAME/YOUR_REPO.git",
    "directory": "frontend/packages/fromchat-protocol"
  }
}
```

### 4. Build and publish

```bash
cd frontend/packages/fromchat-protocol
npm run build
npm publish
```

### 5. Install from GitHub Packages

Users can install your package with:

```bash
npm install @fromchat/protocol@npm:@fromchat/protocol
```

Or add to `.npmrc`:

```
@fromchat:registry=https://npm.pkg.github.com
```

## Using the Published Package

### From npm

```bash
npm install @fromchat/protocol
```

```typescript
import { FromChatProtocol } from "@fromchat/protocol";
```

### From GitHub Packages

```bash
npm install @fromchat/protocol@npm:@fromchat/protocol
```

## Notes

- The package is built to `dist/` directory
- Source files in `src/` are excluded from the published package
- Only `dist/` and `README.md` are included in the published package
- The package uses ES modules (ESM) format
- TypeScript definitions are included in `dist/`

