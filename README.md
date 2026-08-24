<div align="center">

<img src="attached_assets/storylingo-cover.png" width="100%" alt="A child learning languages with StoryLingo's owl story companion" />

# StoryLingo

**Turn language practice into a story children can talk to.**

</div>

A voice-first language learning app for kids (ages 3-10) that uses fairy tales and AI storytelling. Kids have real-time voice conversations with story characters using OpenAI's Realtime API.

## The product bet

Young learners get more speaking practice when the conversation feels like play. StoryLingo puts the learner inside familiar stories, where an AI character can listen, respond in real time, and gently keep the adventure moving in the language they are practising.

## Product status

This repository is a **working prototype**. The former public Railway demo is currently offline, so the source and local setup below are the reliable ways to explore it.

For a more guided deployment walkthrough, see the separate [StoryLingo teaching repository](https://github.com/deewang/storylingo-demo).

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
