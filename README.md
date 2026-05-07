# StoryLingo

A voice-first language learning app for kids (ages 3-10) that uses fairy tales and AI storytelling. Kids have real-time voice conversations with story characters using OpenAI's Realtime API.

## Deployed App

**Live:** [https://storylingo-production.up.railway.app](https://storylingo-production.up.railway.app)

[Railway project dashboard](https://railway.com/project/f25e6e37-bb04-4dbc-8742-753a1759a087)

## Prerequisites

- Node.js 18+
- npm
- An [OpenAI API key](https://platform.openai.com/api-keys) with access to the Realtime API

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables:**

   Create a `.env` file in the project root:

   ```
   OPENAI_API_KEY=sk-your-openai-api-key
   ```

3. **Start the development servers:**

   You need two terminals — one for the Expo client (frontend) and one for the API server (backend).

   **Terminal 1 — Expo dev server (frontend):**

   ```bash
   npx expo start --web
   ```

   This starts the Expo bundler and serves the web app. Once ready, open:

   ```
   http://localhost:8081
   ```

   **Terminal 2 — API server (backend):**

   ```bash
   npm run server:dev
   ```

   This starts the backend server on port 5000, which proxies OpenAI Realtime API sessions.

4. **Open the app** in your browser at [http://localhost:8081](http://localhost:8081).

   > The app uses WebRTC for voice, which only works in the browser (not in React Native iOS/Android simulators).

## Production Build & Deployment

```bash
npm run build   # Builds both the Expo web bundle and the server
npm start       # Starts the production server
```

The app is deployed to [Railway](https://railway.app). Pushing to `main` triggers an automatic build and deploy via the `railway.json` config. The build runs `npm run build` (Expo web export + server bundle) and starts with `npm run server:prod`.

## Project Structure

```
client/           # Expo/React Native frontend
  screens/        # App screens (Home, StorySelection, Session, etc.)
  constants/      # Theme, stories data
  context/        # React contexts (Language, Subscription, Progress)
  navigation/     # React Navigation stack
  components/     # Shared components
server/           # Express backend (OpenAI session proxy)
attached_assets/  # Story card images
```

## Tech Stack

- **Frontend:** Expo (React Native for Web), React Navigation, Reanimated
- **Voice:** OpenAI Realtime API via WebRTC data channel
- **Backend:** Express + TypeScript
- **Storage:** AsyncStorage (client-side, no database)
