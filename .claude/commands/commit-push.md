Commit the current changes and push them to `main`.

1. Run `git branch --show-current`. If it is not `main`, stop and tell me; never push to any other branch.
2. Run `git status` and `git diff`. Never commit `.env*` files (except `.env.example`), keys or tokens.
3. Group the changes into small focused commits in Conventional Commits format (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`). No Claude attribution in messages.
4. Run `git push origin main`. Never force push. If the push is rejected, stop and tell me.
5. Report the commits created (hash and message) and the push result.
