import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import type {
  AnswerAttribute,
  AnswerCategory,
  BroadQuestionTopic,
  ChildIntent,
  ThinkGuessLanguage,
} from "@shared/thinkGuess";

export type SupportStage =
  | "discover"
  | "connect"
  | "coach"
  | "narrow"
  | "resolve";

export type ConversationOutcome =
  | "continue"
  | "incorrect_guess"
  | "solved"
  | "answer_revealed"
  | "turn_limit_reveal"
  | "reveal_locked"
  | "repeat"
  | "stopped"
  | "unclear"
  | "dont_know"
  | "off_topic";

export type ThinkGuessConversationTurn = {
  targetLanguage: ThinkGuessLanguage;
  languageLevel: number;
  reasoningLevel: number;
  childTranscript?: string;
  childIntent: ChildIntent;
  normalizedGuess?: string;
  outcome: ConversationOutcome;
  reasoningTurnNumber: number;
  remainingReasoningTurns: number;
  turnLimit: 10;
  supportStage: SupportStage;
  hintLevel: number;
  hintsUsed: number;
  remainingHintsBeforeReveal: number;
  currentFact?: string;
  knownClues: string[];
  questionTypesAsked: (AnswerAttribute | BroadQuestionTopic)[];
  previousReply: string;
  categoryMayBeNamed: boolean;
  answerMayBeNamed: boolean;
  secretObject: {
    canonicalAnswer: string;
    category: AnswerCategory;
    approvedAttributes: Partial<Record<AnswerAttribute, boolean>>;
    seedFacts: string[];
  };
  fallbackReply: string;
};

export const THINK_GUESS_AI_PROMPT = `# ROLE
You are the conversational brain for StoryLingo's Think & Guess voice game for children ages 4–7. The child asks questions to discover a secret object. Make the exchange feel spontaneous, warm, funny when appropriate, and genuinely responsive.

The target language for this session is {{target_language}}.

# LEARNING GOAL
Help the child practise deductive thinking. Every yes confirms something. Every no rules something out. An incorrect guess is useful progress, never failure. Help the child connect clues and gradually ask more informative questions without sounding like a teacher or quiz host.

# PRIVATE GAME STATE
The application sends one JSON object for the current turn. It contains the child's latest words, the secret object, approved attributes and seed facts, earlier discoveries, turn state, and mechanical outcome.

The secretObject is private. Never mention its canonicalAnswer before answerMayBeNamed is true. Do not disclose its category unless categoryMayBeNamed is true or that category already appears in knownClues. The mechanical outcome, turn count, reveal permission, stop state, and solved state are fixed. Do not change them.

Use currentFact for its meaning, not its wording. You may phrase it naturally and connect it to earlier clues. You may use stable, ordinary knowledge about the secret object to answer a child's natural follow-up or create a fresh clue, but never contradict the supplied attributes or seed facts. If a fact is genuinely uncertain or varies in real life, say so simply instead of pretending certainty.

# CONVERSATION BEHAVIOUR
- Answer the child's actual question first. Never replace the requested answer with a recap of an older clue.
- Create your own child-friendly wording rather than relying on stock response templates.
- For a useful question, show briefly how the answer narrows the mystery when that connection is helpful.
- For an incorrect guess, respond lightly and show what was learned. Do not say or imply that the child is doing badly.
- For a hint, create one fresh clue from a new angle. Do not repeat a clue already in knownClues, and do not name the answer.
- For dont_know or repeated random guesses, offer one concrete, easy next question.
- For unclear speech, ask for one friendly retry and add no new clue.
- For off-topic speech, acknowledge it lightly and guide the child back in one sentence.
- For repeat, repeat previousReply faithfully; a short natural lead-in is allowed.
- For stopped, accept immediately and do not continue the game.
- For solved, answer_revealed, or turn_limit_reveal, name the supplied canonicalAnswer and celebrate the reasoning journey rather than a score.
- For reveal_locked, do not name the answer. Explain briefly that a few more clues come first.

# PROGRESSION
- discover, turns 1–3: keep support light and let the child lead.
- connect, turns 4–6: sometimes connect the new discovery to one earlier clue.
- coach, turns 7–8: suggest one useful question or reasoning step when needed.
- narrow, turn 9: help the child compare the strongest possibilities without revealing the answer.
- resolve, turn 10: warmly reveal the answer and mention how the clues helped.

# VOICE AND TONE
Speak in {{target_language}}, even when the child mixes languages. Use vocabulary suitable for the supplied languageLevel while keeping the reasoning respectful.

Sound upbeat, friendly, curious, patient, and gently playful. Use natural contractions and varied phrasing. Do not sound robotic, babyish, sing-song, theatrical, overly praising, or like a game-show host. Save the biggest excitement for solving or completing the mystery.

# RESPONSE SHAPE
Return only the words that should be shown and spoken to the child. Do not return JSON, labels, quotation marks, stage names, or explanations.

Use one to three short sentences. Usually stay under 45 spoken words; completion may use up to 65. Ask at most one question. Give one conversational action per response.

# SAFETY AND PRIVACY
Keep everything appropriate for ages 4–7. Never ask for or repeat a child's full name, address, school, location, contact details, or other personal information. Do not introduce frightening, violent, sexual, or otherwise inappropriate content.`;

export const THINK_GUESS_VOICE_INSTRUCTIONS = `# ROLE
You are the warm, expressive voice of StoryLingo's Think & Guess game for children ages 4–7.

# DELIVERY
- Read the supplied generated Think & Guess reply exactly. Do not add, remove, paraphrase, or answer it.
- Use a relaxed conversational pace with gentle delight, not a rushed or sing-song cadence.
- Pause naturally between sentences.
- Sound encouraging but not babyish, theatrical, or like a game-show host.
- Keep routine clues calm. Use brighter celebration only when the supplied words solve or reveal the mystery.

# BOUNDARIES
Never independently answer child audio. Wait for an explicit response.create event before speaking.`;

export interface ThinkGuessResponseWriter {
  write(update: ThinkGuessConversationTurn): Promise<string>;
}

export class PassthroughResponseWriter implements ThinkGuessResponseWriter {
  async write(update: ThinkGuessConversationTurn): Promise<string> {
    return update.fallbackReply;
  }
}

type ResponseRequest = ResponseCreateParamsNonStreaming;

const targetLanguageNames: Record<ThinkGuessLanguage, string> = {
  en: "English",
  zh: "Mandarin Chinese",
  es: "Spanish",
};

function localPromptFor(language: ThinkGuessLanguage): string {
  return THINK_GUESS_AI_PROMPT.replaceAll(
    "{{target_language}}",
    targetLanguageNames[language],
  );
}

export function modelInputFor(
  update: ThinkGuessConversationTurn,
): Omit<ThinkGuessConversationTurn, "fallbackReply"> {
  const { fallbackReply: _fallbackReply, ...modelInput } = update;
  return modelInput;
}

export function buildThinkGuessResponseRequest(
  update: ThinkGuessConversationTurn,
  environment: NodeJS.ProcessEnv = process.env,
): ResponseRequest {
  const configuredPromptId = environment.THINK_GUESS_PROMPT_ID?.trim();
  const promptId =
    configuredPromptId && configuredPromptId !== "local"
      ? configuredPromptId
      : undefined;
  const promptVersion = environment.THINK_GUESS_PROMPT_VERSION?.trim();
  const shared = {
    model: environment.THINK_GUESS_RESPONSE_MODEL || "gpt-4.1-mini",
    store: false,
    max_output_tokens: 512,
    input: JSON.stringify(modelInputFor(update)),
  } satisfies ResponseRequest;

  if (promptId) {
    return {
      ...shared,
      prompt: {
        id: promptId,
        variables: {
          target_language: targetLanguageNames[update.targetLanguage],
        },
        ...(promptVersion ? { version: promptVersion } : {}),
      },
    };
  }

  return { ...shared, instructions: localPromptFor(update.targetLanguage) };
}

export function cleanThinkGuessModelReply(value: string): string {
  const trimmed = value
    .trim()
    .replace(/^```(?:text|json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  if (!trimmed.startsWith("{"))
    return trimmed.replace(/^(["'])|(["'])$/g, "").trim();

  try {
    const parsed = JSON.parse(trimmed) as { reply?: unknown };
    return typeof parsed.reply === "string" ? parsed.reply.trim() : trimmed;
  } catch {
    return trimmed;
  }
}

export class OpenAIThinkGuessResponseWriter
  implements ThinkGuessResponseWriter
{
  private readonly client: OpenAI | null;

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    this.client = apiKey
      ? new OpenAI({ apiKey, timeout: 5_000, maxRetries: 0 })
      : null;
  }

  async write(update: ThinkGuessConversationTurn): Promise<string> {
    if (!this.client) return update.fallbackReply;

    try {
      const response = await this.client.responses.create(
        buildThinkGuessResponseRequest(update),
      );
      const reply = cleanThinkGuessModelReply(response.output_text);
      return reply || update.fallbackReply;
    } catch (error) {
      console.warn("Think & Guess AI response fallback:", error);
      return update.fallbackReply;
    }
  }
}
