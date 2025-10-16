# Code Cleanup Command

## Overview
Analyze git diff between the specified branch and HEAD (defaults to main if no branch specified) and clean up code quality issues without altering functionality.

## Process
1. **Get diff**: Run `git diff <branch>..HEAD` to see changes
2. **Identify issues**: Look for code quality problems in the diff
3. **Clean up**: Remove only the identified issues
4. **Verify**: Ensure no behavioral changes

## What to Clean Up
- **Debug artifacts**: `console.log()`, `debugger`, `print()` statements
- **Unused code**: Variables, imports, functions, parameters
- **Commented code**: Dead code blocks, TODO comments (unless active)
- **Formatting**: Inconsistent spacing, trailing whitespace
- **Temporary code**: Test values, hardcoded strings meant to be dynamic
- **Redundant code**: Duplicate logic, unnecessary intermediate variables

## What NOT to Touch
- **Functional logic**: Don't change how features work
- **API interfaces**: Keep method signatures intact
- **Configuration**: Don't modify settings or constants
- **Comments**: Keep documentation and explanatory comments
- **Error handling**: Don't remove try-catch blocks or validation

## Safety Rules
- ✅ Only modify code that appears in the git diff
- ✅ Preserve all existing functionality
- ✅ Maintain code readability and structure
- ❌ Don't refactor or optimize beyond cleanup
- ❌ Don't add new features or improvements
- ❌ Don't change variable names or function signatures

## Example
```bash
# If user specifies: "/clean-up main"
git diff main
# Clean only the issues found in this diff
```