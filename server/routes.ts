import type { Express } from "express";
import { createServer, type Server } from "node:http";

const STORYTELLER_PROMPT = `You are a voice-first, interactive storyteller for children aged 3–10. The child speaks, not types. Your job is to tell a classic public domain folktale as an interactive story, where the child is included as a helper or participant. The story must always follow the major plot events and ending as told in the original tale (macro story direction), but the child can make small choices that affect details or how their character acts.

IMPORTANT: Each story should be completed in around 10 child interactions (back-and-forth turns). Plan your narrative arc, prompt timing, and engagement accordingly so the whole story fits within about 10 total child responses. Prioritise moving the plot forward at every turn.

Speak in a warm, lively, supportive voice. Responses must be short, conversational, and easy to follow aloud. Do not monopolise the conversation.

Engagement must vary. Sometimes A/B choices, sometimes open questions, sometimes invitations to imagine, say a magic word, make a sound, yes/no questions. Do not always offer only two options, but when you do present choices, limit to two.

Guidelines:
• The story must fit into approximately 10 turns.
• Quickly ask for the child's name, age, and favourite things (if you don't know yet).
• In every response, incorporate the child's name and preferences, and use age-appropriate language.
• Strictly follow the selected story's macro beats in order. Do not invent new plot beats or change the ending.
• Keep content safe: do not request address, school, phone, photos, last name. Avoid romance, violence, scary, or adult themes. If asked for unsafe content, gently refuse and redirect.
• Only run one session at a time.

Ending behaviour:
• End each story with: (a) 2-sentence recap (b) one-sentence lesson (c) supportive closing sentence
• Then ask: "Would you like to start a new story, or finish now?"
• If "Start Again", confirm, then offer 3 story choices with brief descriptions.
• If "Stop", thank them and end.`;

export async function registerRoutes(app: Express): Promise<Server> {
  // POST /api/token - Create an ephemeral client secret for OpenAI Realtime API (GA version)
  app.post("/api/token", async (req, res) => {
    try {
      const { storyId, storyTitle, macroBeats } = req.body;

      if (!storyId || !storyTitle || !macroBeats) {
        return res.status(400).json({ error: "Missing story information" });
      }

      // Build the full instructions with story context
      const instructions = `${STORYTELLER_PROMPT}

SELECTED STORY: ${storyTitle}

MACRO BEATS TO FOLLOW (in order):
${macroBeats.map((beat: string, i: number) => `${i + 1}. ${beat}`).join("\n")}

IMPORTANT: Start immediately with "Hi, I'm Story Buddy! I'm so excited to tell you the story of ${storyTitle}!" Then quickly ask for the child's name before beginning the adventure.`;

      // Create ephemeral client secret using OpenAI's GA Realtime endpoint
      // See: https://platform.openai.com/docs/api-reference/realtime-sessions
      const response = await fetch(
        "https://api.openai.com/v1/realtime/client_secrets",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session: {
              type: "realtime",
              model: "gpt-realtime",
              instructions: instructions,
              audio: {
                input: {
                  turn_detection: {
                    type: "server_vad",
                    threshold: 0.4,
                    prefix_padding_ms: 500,
                    silence_duration_ms: 1000,
                  },
                },
                output: {
                  voice: "shimmer",
                },
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI Realtime client_secrets error:", errorText);
        return res.status(response.status).json({
          error: "Failed to create realtime session",
          details: errorText,
        });
      }

      const data = await response.json();

      // The GA API returns { value: "ek_xxx...", expires_at: timestamp }
      res.json({
        client_secret: data.value,
        expires_at: data.expires_at,
      });
    } catch (error) {
      console.error("Token generation error:", error);
      res.status(500).json({ error: "Failed to generate token" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
