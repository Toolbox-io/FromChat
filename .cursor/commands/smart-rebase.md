Please analyze the recent commits in this repository and help me clean up the commit history. I want you to:

1. First, show me all commits between the target ref and HEAD using: `git log --oneline <base-branch>..HEAD`
2. Identify which commits should be squashed together (like cleanup commits, small fixes, or related changes)
3. For each group of commits you plan to squash, read their full details using: `git show <commit-hash>` to understand what changes they contain
4. Create a git-rebase-todo.txt file with your recommended rebase plan
5. Explain your reasoning for the squashing decisions, including what changes each squashed group contains. Be concise.
6. Stop and ask me if i agree with your plan.
7. Then execute the rebase using these exact commands (replace `<base-branch>` with the target branch/ref):
   ```bash
   export GIT_SEQUENCE_EDITOR="cp git-rebase-todo.txt"
   git rebase -i <base-branch>
   ```
8. If there are conflicts, stop and ask me to fix them.
9. Delete the `git-rebase-todo.txt` file you created.s

**Usage:** You can specify a target branch/ref as an argument. If no argument is provided, stop and ask me for the branch or ref to rebase onto.

Focus on:
- Squashing small cleanup commits into their related feature commits
- Combining related bug fixes
- Keeping meaningful feature commits separate
- Maintaining a clean, logical commit history

Please be conservative - if you're unsure about squashing something, ask me for clarification.
