# StoryLingo

A voice-first immersive language learning app for children ages 3-5. Children learn new languages through interactive storytelling where the AI speaks entirely in the target language.

## Overview

StoryLingo uses OpenAI's Realtime API (GA version) to create immersive, voice-based language learning experiences through storytelling. Children select a story and a target language, then engage in a voice conversation with the AI storyteller who:
- Speaks ONLY in the target language (immersive learning approach)
- Uses simple vocabulary and short sentences appropriate for ages 3-5
- Repeats key words naturally to reinforce learning
- Encourages children to repeat words and phrases
- Keeps content safe and age-appropriate

## Project Structure

```
├── client/                 # Expo React Native app
│   ├── App.tsx            # Root component with font loading and LanguageProvider
│   ├── screens/
│   │   ├── HomeScreen.tsx          # Welcome screen with Start button
│   │   ├── StorySelectionScreen.tsx # Choose a story + language toggle
│   │   └── SessionScreen.tsx       # Voice conversation interface
│   ├── navigation/
│   │   └── RootStackNavigator.tsx  # Stack navigation
│   ├── constants/
│   │   ├── theme.ts       # Colors, spacing, typography
│   │   └── stories.ts     # Story IDs and image mappings
│   ├── context/
│   │   ├── LanguageContext.tsx     # Global language state with AsyncStorage persistence
│   │   └── SubscriptionContext.tsx # Subscription/trial management
│   ├── locales/           # Translation files (JSON)
│   │   ├── en.json        # English translations + story content
│   │   ├── zh.json        # Chinese translations + story content
│   │   └── es.json        # Spanish translations + story content
│   └── components/        # Reusable UI components
├── server/                # Express.js backend
│   ├── index.ts          # Server setup
│   ├── routes.ts         # API endpoints including /api/token
│   └── languageConfig.ts # Language-specific prompt IDs and voice settings
└── assets/images/        # App icons and story illustrations
```

## Key Features

1. **Home Screen**: Welcome page with animated mascot and Start button
2. **Story Selection**: Story cards with watercolor illustrations + language toggle
3. **Session Screen**: 
   - Large Talk button (hold to speak)
   - Status indicator (Connecting/Listening/Speaking)
   - Back, Pause/Resume, and Mute controls
4. **Vocabulary Practice (Coming Soon)**: AI-generated keywords from stories that kids can tap and practice

## API Endpoints

- `POST /api/token` - Creates ephemeral client secret for OpenAI Realtime API
  - Request body: `{ storyId, storyTitle, storyContext, macroBeats, language, isInteractive }`
  - Response: `{ client_secret, expires_at }`
  - Uses the GA endpoint: `https://api.openai.com/v1/realtime/client_secrets`

## Environment Variables

- `OPENAI_API_KEY` - Required for OpenAI Realtime API access
- `EXPO_PUBLIC_DOMAIN` - API host used by the web client (for example, `localhost:5000` during local development)

## Running the App

1. Backend runs on port 5000 (`npm run server:dev`)
2. Frontend runs on port 8081 (`npm run expo:dev`)
3. **Web (Recommended for voice)**: Open http://localhost:8081 in browser
4. **Mobile**: Scan QR code with Expo Go app (voice redirects to web)

## OpenAI Realtime API Integration

The app uses OpenAI's GA (General Availability) Realtime API:

1. **Token Generation**: Server calls `/v1/realtime/client_secrets` to create ephemeral keys
2. **WebRTC Connection**: Client uses the token to establish a WebRTC connection via `/v1/realtime/calls`
3. **Session Configuration**: Includes storyteller instructions, voice settings, and turn detection

Key configuration:
- Model: `gpt-realtime`
- Voice: `alloy`
- Turn detection: Server VAD with 500ms silence threshold
- Input transcription: `gpt-4o-mini-transcribe`

## Design

- Storybook magical aesthetic with soft watercolor illustrations
- Primary color: Warm pink (#FF6B9D)
- Secondary color: Sunny yellow (#FFD93D)
- Background: Soft lavender gradient (#E8DEFF → #F8F5FF → #FFE8F0)
- Large, child-friendly touch targets (180pt Talk button)

## Platform Notes

- **Web**: Full voice support via WebRTC
- **Mobile (Expo Go)**: UI works; voice requires web browser due to WebRTC limitations in Expo Go

## Internationalization (i18n) Architecture

The app supports multiple languages with a scalable architecture:

### Client-Side
- **LanguageContext**: Global state provider wraps entire app
  - Language preference persists in AsyncStorage (key: `@storylingo_language`)
  - Provides `useTranslation()` hook for components
  - Includes `t()` function for nested key access (e.g., `t('stories.snow-white.title')`)
  - Includes `getStory(storyId)` for full story object with localized content

### Translation Files (client/locales/*.json)
Each language file contains:
- UI strings (chooseYourStory, session.connecting, vocabularyPractice, etc.)
- Story content (title, description, context, macroBeats per story)
- Voice agent messages (initiationMessage, pauseMessage, resumeMessage)

### Server-Side (server/languageConfig.ts)
- Language-specific prompt IDs with immersive learning instructions for ages 3-5
- Voice settings per language (alloy for all languages currently)
- Emphasis on simple vocabulary, repetition, and encouragement to practice

### Adding a New Language
1. Create new JSON file in `client/locales/` (copy from en.json)
2. Add language config in `server/languageConfig.ts`
3. Add language option to toggle UI in `StorySelectionScreen.tsx`

### Current Languages
- English (en) - Default
- Chinese (zh) - Simplified Mandarin
- Spanish (es)

## Subscription Model

The app includes a freemium subscription model:
- **Free Trial**: 3-day trial with 15-minute daily listening limit
- **Extended Trial**: 30 days free when subscribing (unlimited listening)
- **Subscriptions**: $9.99/month or $99/year

Developer tools are hidden behind a password (3268) - tap "StoryLingo v1.0.0" in Settings to access.

## Recent Changes

- January 29, 2026: Rebranded from StoryTale to StoryLingo
  - Focus shifted to immersive language learning for ages 3-5
  - AI prompts updated to use simple vocabulary and encourage repetition
  - Added "Vocabulary Practice - Coming Soon" feature placeholder
  - Updated app name, subtitle, and messaging throughout
- January 20, 2026: Refactored i18n system for scalability
  - Created LanguageContext with AsyncStorage persistence
  - Moved translations to JSON files (en.json, zh.json, es.json)
  - Added Spanish as third language
  - Server-side languageConfig for voice settings per language
- January 19, 2026: Initial implementation with OpenAI Realtime API GA
