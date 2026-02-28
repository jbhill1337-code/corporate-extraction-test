# Push this project to your morris-clicker GitHub repo

These steps **replace** whatever is currently in your `morris-clicker` repo on GitHub with this project (VP Dave, skill panel, Manny stress test, organized assets).

---

## Option A — Use this folder as the repo and overwrite GitHub

1. **Open a terminal in this folder**  
   (`c:\Users\jbhil\OneDrive\ClickerClankersAssets\morris-boss-v3`)

2. **Initialize Git and make the first commit**
   ```bash
   git init
   git add .
   git commit -m "Corporate Takedown: VP Dave, skills, Manny stress test, hit animations"
   git branch -M main
   ```

3. **Add your GitHub repo as remote**
   ```bash
   git remote add origin https://github.com/jbhill1337-code/morris-clicker.git
   ```
   If you use SSH:
   ```bash
   git remote add origin git@github.com:jbhill1337-code/morris-clicker.git
   ```

4. **Overwrite the existing repo on GitHub**
   ```bash
   git push -u origin main --force
   ```
   `--force` replaces the current contents and history of `morris-clicker` with this project.

After this, your GitHub repo will only contain this project.

---

## Option B — Keep morris-clicker repo and only replace files

Use this if you want to keep the repo’s existing history and only change the files.

1. **Clone morris-clicker** (if you don’t have it yet)
   ```bash
   cd c:\Users\jbhil\OneDrive\ClickerClankersAssets
   git clone https://github.com/jbhill1337-code/morris-clicker.git morris-clicker-temp
   cd morris-clicker-temp
   ```

2. **Remove everything except `.git`**
   - Windows PowerShell:
     ```powershell
     Get-ChildItem -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force
     ```
   - Or delete all files/folders by hand **except** the `.git` folder.

3. **Copy this project into the clone**
   ```powershell
   Copy-Item -Path "..\morris-boss-v3\*" -Destination "." -Recurse -Force
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "Replace with Corporate Takedown (VP Dave, skills, Manny stress test)"
   git push origin main
   ```

5. **Optional:** Remove the temp clone and keep using morris-boss-v3, or rename folders as you like.

---

## If GitHub asks for login

- **HTTPS:** Use a [Personal Access Token](https://github.com/settings/tokens) instead of your password.
- **SSH:** Ensure your SSH key is added to GitHub (`ssh -T git@github.com`).

Repo: **https://github.com/jbhill1337-code/morris-clicker**
