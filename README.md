<div align="center">

<img src="attached_assets/storylingo-cover.png" width="100%" alt="A child learning languages with StoryLingo's owl story companion" />

# StoryLingo

**Help children build speaking confidence through stories they can talk to.**

A browser-first language-learning prototype where young children speak with AI fairy-tale characters and help shape the adventure in real time.

</div>

## What it does

StoryLingo turns language practice into play. A child chooses a target language and story, listens to an AI storyteller, then speaks to the character to answer questions, make choices, and move the adventure forward.

The experience uses short, expressive exchanges designed to give young learners more opportunities to listen and speak in the language they are practising.

## Key features

- **Real-time voice conversations** with an AI storyteller
- **Three language modes:** English, Mandarin Chinese, and Spanish
- **Four playable experiences:** Your Adventure, Snow White, Rapunzel, and Peter Pan
- **Interactive storytelling** that responds to the child's choices while following each tale's main story beats
- **Child-friendly push-to-talk controls** with pause and resume
- **Conversation review** showing both sides of the exchange after a session
- **Locally saved preferences and progress** with no account required
- **Mobile-first, animated interface** that stays full-width on phones and uses a contained, phone-width shell on desktop

## How to use

1. Select **Start**.
2. Choose English, Chinese, or Spanish.
3. Pick a story.
4. Select **Start Story** and allow microphone access.
5. Hold the microphone button while speaking, then release it for the storyteller to respond.
6. Pause when needed or leave the story to review the conversation.

Try the hosted app at [storylingo-production.up.railway.app](https://storylingo-production.up.railway.app/), or follow the local setup below.

## Run locally

### Requirements

- Node.js 20+
- npm
- A microphone-enabled web browser
- An OpenAI API key with Realtime API access

Clone the repository and install its dependencies:

```bash
git clone https://github.com/deewang/storylingo.git
cd storylingo
npm install
```

The prototype references a saved OpenAI prompt in `server/languageConfig.ts`. Make sure `DEFAULT_PROMPT_ID` is available to your OpenAI project, or replace it with your own saved Realtime prompt ID.

Start the API server:

```bash
OPENAI_API_KEY=sk-your-openai-api-key npm run server:dev
```

In a second terminal, start the Expo web client:

```bash
EXPO_PUBLIC_DOMAIN=localhost:5000 npx expo start --web
```

Open [http://localhost:8081](http://localhost:8081).

Run the Playwright browser suite with `npm test`. See [TESTING.md](TESTING.md) for browser setup, current coverage, and test conventions.

## Tech stack

| Layer | Technology |
|---|---|
| Client | React 19, TypeScript, Expo 54, React Native for Web |
| Interface | React Navigation, Reanimated, Expo Haptics, Expo Linear Gradient |
| Voice | OpenAI Realtime API, WebRTC, `gpt-realtime`, `gpt-4o-mini-transcribe` |
| Backend | Express 5, TypeScript |
| Local data | AsyncStorage |
| Testing | Playwright Test with Chromium, GitHub Actions |
| Build and deployment | Expo export, esbuild, Railway configuration |

For more detail, see the [design guidelines](design_guidelines.md) and [implementation notes](replit.md).

## Status and limitations

StoryLingo is a working, browser-first product prototype. The hosted app runs on Railway, and the repository can also be run locally.

Voice conversation is not implemented for native Expo builds. The subscription and paywall screens demonstrate the intended product flow but are not connected to live billing or purchase restoration. User state remains on the local device. The automated Playwright suite currently covers the responsive app shell, story-card containment, navigation to story selection, and breakpoint switching.
