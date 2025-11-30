# StyleConfident AI

Your personal AI stylist that curates confidence-boosting outfits.

## 🚀 How to Deploy to Google Cloud Run (From GitHub)

You can set up continuous deployment so the app updates automatically whenever you push code to GitHub.

### Step 1: Push Code to GitHub
Ensure `Dockerfile`, `nginx.conf`, and `.dockerignore` are in your repository.

### Step 2: Configure Cloud Run
1. Go to **Google Cloud Console** > **Cloud Run**.
2. Click **Create Service**.
3. Select **"Continuously deploy new revisions from a source repository"**.
4. Click **"Set up with Cloud Build"**.
5. Select your **Repository Provider** (GitHub) and your **Repository**.
6. Click **Next**.

### Step 3: Configure Build
1. **Branch**: `^main$`
2. **Build Type**: Select **Dockerfile**.
3. **Source location**: `/Dockerfile` (default).
4. Click **Save**.

### Step 4: Configure Service Settings
1. **Service Name**: `style-confident`
2. **Region**: Choose one close to you (e.g., `us-central1`).
3. **Authentication**: Select **"Allow unauthenticated invocations"** (so the public can access your website).

### Step 5: Add Your API Key (Crucial!)
1. Expand the **"Container, Variables & Secrets, Connections, Security"** section.
2. Go to the **Variables & Secrets** tab.
3. **IMPORTANT**: Since this is a Vite app, the API Key is needed *during the build*. 
   However, the standard Cloud Run UI sets variables for *runtime*.
   
   **Workaround for UI Deployment:**
   To make this work purely via UI, you might need to add the API Key to your Dockerfile directly (not recommended for security) OR use **Cloud Build Triggers** directly instead of the Cloud Run shortcut.

   **Recommended Path (Cloud Build Trigger):**
   1. Go to **Cloud Build** > **Triggers**.
   2. Find the trigger created by Cloud Run.
   3. Click **Edit**.
   4. Under **Substitution variables**, add a new variable:
      - Variable: `_VITE_API_KEY`
      - Value: `your-actual-gemini-api-key`
   5. Update your `Dockerfile` args in the "Docker build arguments" section if available, OR simply map it in the inline build config.

### Simple Alternative (Manual Deploy via Cloud Shell)
If the UI setup is too complex regarding the build arguments, use the **Cloud Shell** (icon in top right of Google Cloud Console):

```bash
# 1. Clone your repo
git clone https://github.com/YOUR_USER/YOUR_REPO.git
cd YOUR_REPO

# 2. Deploy
gcloud run deploy style-confident \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --build-arg VITE_API_KEY=your_actual_key_here
```
