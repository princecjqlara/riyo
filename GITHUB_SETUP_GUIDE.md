# GitHub Setup Guide - Baratillo Project

This guide will walk you through connecting your project to GitHub and getting your Personal Access Token.

## ✅ Already Completed

- ✅ `.env.local` file created with your Supabase credentials
- ✅ Dependencies installed
- ✅ GitHub remote configured: `https://github.com/princecjqlara/riyo.git`

---

## 📋 Step 1: Get Your GitHub Personal Access Token

### Why You Need It
GitHub no longer accepts passwords for authentication. You need a Personal Access Token (PAT) to push code to your repositories.

### How to Create a Personal Access Token

1. **Go to GitHub Settings**
   - Open your browser and go to: https://github.com/settings/tokens
   - Or click your profile picture → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **Generate New Token**
   - Click **"Generate new token"** → **"Generate new token (classic)"**

3. **Configure Token Settings**
   - **Note**: Give it a name like "Baratillo Project" or "Riyo Repository"
   - **Expiration**: Choose how long you want it to work (90 days, or custom)
   - **Select Scopes**: Check these boxes:
     - ✅ `repo` - Full control of private repositories (includes all repo permissions)
       - This gives access to read/write code, issues, pull requests, etc.

4. **Generate and Copy Token**
   - Scroll down and click **"Generate token"**
   - ⚠️ **IMPORTANT**: Copy the token immediately! It will look like:
     ```
     ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
     ```
   - You won't be able to see it again after you leave the page!

---

## 📋 Step 2: Connect and Push to GitHub

Once you have your Personal Access Token, follow these steps:

### Option A: Using HTTPS (Recommended for beginners)

1. **Open Terminal in your project folder**
   ```bash
   cd /c/Users/bigcl/Downloads/baratillo
   ```

2. **Make your initial commit**
   ```bash
   git add .
   git commit -m "Initial commit: Baratillo image-based price lookup system"
   ```

3. **Push to GitHub** (You'll be prompted for credentials)
   ```bash
   git branch -M main
   git push -u origin main
   ```

4. **When prompted for credentials:**
   - **Username**: Your GitHub username (e.g., `princecjqlara`)
   - **Password**: Paste your Personal Access Token (NOT your GitHub password)

### Option B: Using Token in URL (Alternative method)

If the above doesn't work, you can embed the token in the remote URL:

1. **Update remote with token**
   ```bash
   git remote set-url origin https://YOUR_TOKEN@github.com/princecjqlara/riyo.git
   ```
   Replace `YOUR_TOKEN` with your actual token.

2. **Then push normally**
   ```bash
   git add .
   git commit -m "Initial commit: Baratillo image-based price lookup system"
   git branch -M main
   git push -u origin main
   ```

---

## 📋 Step 3: Verify Your Setup

After pushing, verify everything worked:

1. **Check your repository**: Go to https://github.com/princecjqlara/riyo
2. You should see all your project files there!

---

## 📋 Step 4: Run Your Project Locally

Now that everything is set up, you can run your development server:

```bash
npm run dev
```

Then open: **http://localhost:3000**

---

## 🔒 Security Notes

1. **Never commit `.env.local`** - It contains sensitive keys and is already in `.gitignore`
2. **Keep your Personal Access Token secret** - Don't share it or commit it to GitHub
3. **Use token expiration** - Set your token to expire after a reasonable time period
4. **Revoke if compromised** - If you think your token was exposed, revoke it immediately from GitHub settings

---

## 🆘 Troubleshooting

### "Authentication failed" error
- Make sure you're using the Personal Access Token, not your GitHub password
- Check that the token has `repo` permissions
- Verify the token hasn't expired

### "Repository not found" error
- Make sure the repository exists at: https://github.com/princecjqlara/riyo
- Check that you have write access to the repository
- Verify the remote URL: `git remote -v`

### "Permission denied" error
- Ensure your token has the correct scopes (especially `repo`)
- Try generating a new token if the old one doesn't work

---

## 📝 Quick Reference Commands

```bash
# Check git status
git status

# Check remote configuration
git remote -v

# Stage all files
git add .

# Commit changes
git commit -m "Your commit message"

# Push to GitHub
git push -u origin main

# Pull latest changes
git pull origin main

# View commit history
git log
```

---

## 🎯 Next Steps After Setup

1. **Run the database migrations** in Supabase:
   - Go to your Supabase dashboard
   - SQL Editor → Run `supabase/migrations/001_initial_schema.sql`

2. **Create storage bucket** in Supabase:
   - Storage → Create bucket → Name: `product-images` → Make it public

3. **Create your first admin user** (see README.md for details)

4. **Start developing!** 🚀

---

## 📞 Need Help?

- GitHub Token Help: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
- Git Documentation: https://git-scm.com/doc

Good luck with your project! 🎉

