# Profile Rewriter

A small web app that checks an Upwork title + overview against the Profile Builder
framework and rewrites the weak parts, using only the facts you give it (it never
invents experience, clients, or results).

This is your own standalone app. It's not connected to any Claude account, company
or otherwise — it runs on your own Vercel account with your own API key.

## What you need before you start

1. A free [GitHub](https://github.com) account (to hold the code)
2. A free [Vercel](https://vercel.com) account (to host the app) — you can sign up
   with your GitHub account in one click
3. An Anthropic API key — get one at [console.anthropic.com](https://console.anthropic.com)
   (click "Get API keys" → "Create key"). This is a paid API — each profile check
   costs a fraction of a cent, but you'll need a card on file at console.anthropic.com.

## Step 1 — Put this code on GitHub

If you're comfortable with git:

```bash
cd profile-rewriter-app
git init
git add .
git commit -m "Initial commit"
```

Then create a new empty repo on GitHub (github.com → "New repository", don't
add a README/gitignore there), and push:

```bash
git remote add origin https://github.com/YOUR-USERNAME/profile-rewriter.git
git branch -M main
git push -u origin main
```

If you'd rather not use the command line, GitHub Desktop (desktop.github.com) does
the same thing with buttons: "Add local repository" → pick this folder → "Publish repository."

## Step 2 — Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import" next to the GitHub repo you just created
3. Before clicking Deploy, open "Environment Variables" and add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: (paste the key from console.anthropic.com)
4. Click **Deploy**

Vercel builds the app and gives you a live URL (something like
`profile-rewriter.vercel.app`) in about a minute. That's it — the app is live and
only you have the API key (it lives only in Vercel's server settings, never in
the code or in the browser).

## Making changes later

Any time you want to tweak the wording, colors, or the AI prompt itself, edit the
files and push to GitHub again (`git add . && git commit -m "..." && git push`) —
Vercel automatically redeploys within a minute or two.

## Running it on your own computer first (optional)

If you want to try it locally before deploying:

```bash
npm install
cp .env.example .env.local
# then open .env.local and paste your real API key in place of "your-key-here"
npm run dev
```

Then open http://localhost:3000

## Where things live

- `app/page.js` — the page people see and use (the form + results)
- `app/api/analyze/route.js` — the server-side code that calls Claude with your
  API key (this never runs in the browser, so the key is never exposed)
- `app/globals.css` — all the styling
- `app/layout.js` — page title/fonts

## Cost

Each check is one short Claude API call — at current pricing that's a small
fraction of a cent per use. There's no other cost beyond your Anthropic API
usage; Vercel's free tier covers hosting for a personal tool like this.
