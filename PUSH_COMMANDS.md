# Push Onlifit to New GitHub Repo

## Commands to Run (Copy and paste these)

```bash
# 1. Navigate to your project folder
cd "C:\Users\Garima Singh\Downloads\Onlifit"

# 2. Remove old remote (if exists)
git remote remove origin

# 3. Add new remote to your new repo
git remote add origin https://github.com/onlifitapp-lab/onlifitsite.git

# 4. Check current branch name
git branch

# 5. If branch is not 'main', rename it
git branch -M main

# 6. Stage all files
git add .

# 7. Commit all files
git commit -m "Initial commit: Complete Onlifit platform with Google OAuth"

# 8. Push to GitHub
git push -u origin main
```

## If you get authentication errors:

GitHub may ask for credentials:
- **Username:** onlifitapp-lab
- **Password:** You need a Personal Access Token (not your password)

To get a token:
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name: "Onlifit deployment"
4. Check: "repo" scope
5. Click "Generate token"
6. Copy the token and use it as password

## Or use GitHub Desktop (easier):

1. Download: https://desktop.github.com/
2. Sign in
3. File → Add Local Repository
4. Browse to: C:\Users\Garima Singh\Downloads\Onlifit
5. Click "Publish repository"
6. Done!
