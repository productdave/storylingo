# Story Buddy

A voice-first interactive storyteller app for children ages 3-10. Children can have real-time voice conversations with an AI storyteller who guides them through classic fairy tales.

## Overview

Story Buddy uses OpenAI's Realtime API to create interactive, voice-based storytelling experiences. Children select a story (Snow White, Rapunzel, or Peter Pan) and then engage in a voice conversation with the AI storyteller who:
- Asks for the child's name, age, and favorite things
- Tells the story with the child as a participant
- Offers choices and interactive moments throughout
- Keeps content safe and age-appropriate

## Project Structure

```
├── client/                 # Expo React Native app
│   ├── App.tsx            # Root component with font loading
│   ├── screens/
│   │   ├── HomeScreen.tsx          # Welcome screen with Start button
│   │   ├── StorySelectionScreen.tsx # Choose a story
│   │   └── SessionScreen.tsx       # Voice conversation interface
│   ├── navigation/
│   │   └── RootStackNavigator.tsx  # Stack navigation
│   ├── constants/
│   │   ├── theme.ts       # Colors, spacing, typography
│   │   └── stories.ts     # Story data and macro beats
│   └── components/        # Reusable UI components
├── server/                # Express.js backend
│   ├── index.ts          # Server setup
│   └── routes.ts         # API endpoints including /api/token
└── assets/images/        # App icons and story illustrations
```

## Key Features

1. **Home Screen**: Welcome page with animated mascot and Start button
2. **Story Selection**: Three story cards with illustrations
3. **Session Screen**: 
   - Large Talk button (tap to connect)
   - Status indicator (Connecting/Listening/Speaking)
   - Stop and Start Again controls

## API Endpoints

- `POST /api/token` - Creates ephemeral client secret for OpenAI Realtime API
  - Request body: `{ storyId, storyTitle, macroBeats }`
  - Response: `{ client_secret, expires_at }`

## Environment Variables

- `OPENAI_API_KEY` - Required for OpenAI Realtime API access

## Running the App

1. Backend runs on port 5000 (`npm run server:dev`)
2. Frontend runs on port 8081 (`npm run expo:dev`)
3. Scan QR code with Expo Go app on your phone to test

## Technical Notes

- Uses OpenAI Realtime API with WebSocket connection
- Ephemeral tokens are minted server-side for security
- Voice detection uses server-side VAD (Voice Activity Detection)
- Audio transcription powered by Whisper

## Design

- Storybook magical aesthetic with soft watercolor illustrations
- Primary color: Warm pink (#FF6B9D)
- Background: Soft lavender gradient
- Large, child-friendly touch targets

## Recent Changes

- January 19, 2026: Initial implementation with all core features
