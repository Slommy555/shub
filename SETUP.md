# SETUP.md — Fresh Windows Setup Guide

Complete setup guide for getting this project running on a fresh Windows machine. Follow every step in order.

---

## STEP 1 — Install Node.js

1. Go to https://nodejs.org
2. Download the **LTS version** (the left button, not "Current")
3. Run the installer — accept all defaults, make sure "Add to PATH" is checked
4. Restart your computer after installation
5. Verify by opening Command Prompt and running:
   ```
   node --version
   npm --version
   ```
   Both should print a version number. If they do, Node is installed correctly.

---

## STEP 2 — Install Git

1. Go to https://git-scm.com/download/win
2. Download and run the installer
3. Accept all defaults — when asked about default editor, 
   pick whatever you're comfortable with (VS Code if installed)
4. Verify:
   ```
   git --version
   ```

---

## STEP 3 — Install VS Code (recommended editor)

1. Go to https://code.visualstudio.com
2. Download and install for Windows
3. During install, check both:
   - "Add to PATH"
   - "Add Open with Code to context menu"

---

## STEP 4 — Install Claude Code

1. Open Command Prompt or PowerShell
2. Run:
   ```
   npm install -g @anthropic/claude-code
   ```
3. Verify:
   ```
   claude --version
   ```
4. Log in when prompted — use your Anthropic account

---

## STEP 5 — Install Supabase CLI

1. In Command Prompt or PowerShell run:
   ```
   npm install -g supabase
   ```
2. Verify:
   ```
   supabase --version
   ```
   If the command isn't found after install, try:
   ```
   npx supabase --version
   ```
   If npx works but supabase doesn't, use `npx supabase` 
   instead of `supabase` for all commands going forward.

---

## STEP 6 — Install Expo CLI (for the iOS app)

1. Run:
   ```
   npm install -g expo-cli eas-cli
   ```
2. Verify:
   ```
   expo --version
   ```

---

## STEP 7 — Clone the Repository

1. Open Command Prompt or PowerShell
2. Navigate to where you want the project:
   ```
   cd C:\Users\YourName\Documents
   ```
3. Clone the repo:
   ```
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   ```
   Replace with your actual GitHub repo URL.
4. Enter the project folder:
   ```
   cd YOUR_REPO_NAME
   ```

---

## STEP 8 — Install Web App Dependencies

1. Navigate to the web app folder:
   ```
   cd web
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Go back to project root:
   ```
   cd ..
   ```

---

## STEP 9 — Install iOS App Dependencies

1. Navigate to the apple folder:
   ```
   cd apple
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Go back to project root:
   ```
   cd ..
   ```

---

## STEP 10 — Set Up Environment Variables

The app needs two .env.local files — one for the web app 
and one for the iOS app. These are NOT in GitHub 
(they contain secrets) so you need to create them manually.

### Web app (.env.local inside web/)
Create a file at `web/.env.local` with this content:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
```

### iOS app (.env.local inside apple/)
Create a file at `apple/.env.local` with this content:
```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

**Where to get these values:**
- Supabase URL and Anon Key: 
  Supabase dashboard → your project → Settings → API
- VAPID Public Key: 
  Check your existing home machine's web/.env.local

---

## STEP 11 — Link Supabase Project

1. From the project root, run:
   ```
   npx supabase login
   ```
2. It will open a browser — log in with your Supabase account
3. Link to your project:
   ```
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
   Your project ref is in your Supabase dashboard URL:
   `https://supabase.com/dashboard/project/YOUR_REF`

---

## STEP 12 — Verify Everything Works

### Test the web app:
```
cd web
npm run dev
```
Open http://localhost:5173 in your browser.
You should see the app login screen.
Press Ctrl+C to stop.

### Test the iOS app:
```
cd apple
npx expo start
```
Scan the QR code with Expo Go on your iPhone.
Press Ctrl+C to stop.

---

## STEP 13 — Open in Claude Code

From the project root:
```
claude
```
Claude Code will read CLAUDE.md automatically and 
follow all project rules (auto-deploy, migrations etc).

---

## DAILY WORKFLOW ON THIS MACHINE

Start web app for local testing:
```
cd web && npm run dev
```

Start iOS app for local testing:
```
cd apple && npx expo start
```

Open Claude Code:
```
cd YOUR_PROJECT_FOLDER
claude
```

Pull latest changes from GitHub before starting work:
```
git pull
```

---

## TROUBLESHOOTING

**"npm is not recognized"**
Node wasn't added to PATH. Reinstall Node.js and make 
sure "Add to PATH" is checked, then restart your computer.

**"supabase is not recognized"**
Use `npx supabase` instead of `supabase` for all commands.

**"Module not found" errors when running the app**
You need to reinstall dependencies:
```
cd web && npm install
cd ../apple && npm install
```

**Web app builds but shows blank screen**
Check that web/.env.local exists and has the correct 
Supabase URL and anon key.

**Expo app can't connect to Supabase**
Check that apple/.env.local exists and has the correct 
values matching your web/.env.local Supabase credentials.

**Git push asks for username/password every time**
Set up a GitHub personal access token:
1. GitHub → Settings → Developer Settings → 
   Personal Access Tokens → Generate new token
2. Give it repo permissions
3. Use this token as your password when Git prompts you
Or set up SSH keys for a permanent fix:
https://docs.github.com/en/authentication/connecting-to-github-with-ssh

---

## WHAT'S ON THIS MACHINE vs SUPABASE

This machine runs:
- The web app (React + Vite)
- The iOS app (Expo)
- Claude Code for development

Supabase hosts (in the cloud, nothing to install):
- The database
- Edge Functions
- Auth
- Real-time subscriptions

You never need to run a local database — 
everything connects to the same live Supabase project 
your home machine uses.
