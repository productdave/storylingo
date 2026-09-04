<div align="center">

<img src="attached_assets/storylingo-cover.png" width="100%" alt="A child learning languages with StoryLingo's owl story companion" />

# StoryLingo

**Help children build speaking confidence through stories they can talk to.**

A browser-first language-learning prototype where young children speak with AI fairy-tale characters, shape adventures, and solve playful reasoning mysteries.

</div>

## What it does

StoryLingo turns language practice into play. Children can choose a Story Adventure or play Think & Guess, a guided question game where the server keeps a mystery answer and the child reasons toward it in the target language.

The experience uses short, expressive exchanges designed to give young learners more opportunities to listen and speak in the language they are practising.

## Key features

- **Real-time voice conversations** with an AI storyteller
- **Three language modes:** English, Mandarin Chinese, and Spanish
- **Four playable experiences:** Your Adventure, Snow White, Rapunzel, and Peter Pan
- **Think & Guess pilot:** 30 localized mysteries with an AI-led reasoning conversation, progressive clues, and child-safe recovery
- **Interactive storytelling** that responds to the child's choices while following each tale's main story beats
- **Child-friendly push-to-talk controls** with pause and resume
- **Conversation review** showing both sides of the exchange after a session
- **Locally saved preferences and progress** with no account required
- **Mobile-first, animated interface** that stays full-width on phones and uses a contained, phone-width shell on desktop

## How to use

1. Choose **Story Adventures** or **Think & Guess** on Home.
2. Choose English, Chinese, or Spanish.
3. For a story, select a tale and start the voice session. For Think & Guess, select **I Guess**.
4. Allow microphone access, hold the microphone button while speaking, then release it.
5. Ask yes/no questions, request a clue, or guess the mystery object.

Try the hosted app at [storylingo-production.up.railway.app](https://storylingo-production.up.railway.app/), or follow the local setup below.

## Run locally

### Requirements

- Node.js 20+
- npm
- A microphone-enabled web browser
- An OpenAI API key with Realtime API access

Clone the repository and install its dependencies:

```bash
git clone https://github.com/productdave/storylingo.git
cd storylingo
npm install
```

Create a local environment file. The non-voice game works without a key; add the key to test microphone conversations:

```bash
cp .env.example .env
# Edit .env and add OPENAI_API_KEY if you want to test voice.
```

Start the API and web client together:

```bash
npm run dev
```

Open [http://localhost:8081](http://localhost:8081).

The prototype references a saved OpenAI prompt in `server/languageConfig.ts` for Story Adventures. Think & Guess has a separate prompt and never shares the StoryTale context. Its response writer uses the repository prompt with `gpt-4.1-mini` by default; an optional saved Chat/Responses prompt can be configured as documented in [`docs/think-guess-openai-platform-prompt.md`](docs/think-guess-openai-platform-prompt.md). Realtime is used separately for voice delivery. Without an OpenAI key, the game falls back to localized deterministic replies so it remains playable.

Run the Playwright browser suite with `npm test`. See [TESTING.md](TESTING.md) for browser setup, current coverage, and test conventions.

## Tech stack

| Layer                | Technology                                                              |
| -------------------- | ----------------------------------------------------------------------- |
| Client               | React 19, TypeScript, Expo 54, React Native for Web                     |
| Interface            | React Navigation, Reanimated, Expo Haptics, Expo Linear Gradient        |
| Voice                | OpenAI Realtime API, WebRTC, `gpt-realtime-2`, `gpt-4o-mini-transcribe` |
| Backend              | Express 5, TypeScript                                                   |
| Local data           | AsyncStorage (preferences and derived progress only)                    |
| Testing              | Node test runner, Playwright Test with Chromium, GitHub Actions         |
| Build and deployment | Expo export, esbuild, Railway configuration                             |

For more detail, see the [design guidelines](design_guidelines.md) and [implementation notes](replit.md).

## Status and limitations

StoryLingo is a working, browser-first product prototype. The hosted app runs on Railway, and the repository can also be run locally.

Voice conversation is not implemented for native Expo builds. Stories and the I Guess pilot are available without a trial, listening limit, subscription, or payment flow. User language and derived progress state remain on the local device; Think & Guess does not persist audio or transcripts. Pilot rounds use TTL-bounded in-memory server storage and may be lost when the server restarts. AI Guesses is represented in navigation as a disabled future mode.
