import type { Express } from "express";
import { createServer, type Server } from "node:http";

export async function registerRoutes(app: Express): Promise<Server> {
  // POST /api/token - Create an ephemeral client secret for OpenAI Realtime API (GA version)
  app.post("/api/token", async (req, res) => {
    try {
      const { storyId, storyTitle, macroBeats } = req.body;

      if (!storyId || !storyTitle || !macroBeats) {
        return res.status(400).json({ error: "Missing story information" });
      }

      // Build supplementary instructions with story context
      // These will be appended to the saved prompt's instructions
      const storyInstructions = `
SELECTED STORY: ${storyTitle}

MACRO BEATS TO FOLLOW (in order):
${macroBeats.map((beat: string, i: number) => `${i + 1}. ${beat}`).join("\n")}

IMPORTANT: Start immediately with "Hi, I'm Story Buddy! I'm so excited to tell you the story of ${storyTitle}!" Then quickly ask for the child's name before beginning the adventure.`;

      // Create ephemeral client secret using OpenAI's GA Realtime endpoint
      // Uses the user's saved prompt ID from OpenAI dashboard
      // The instructions field supplements the saved prompt
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
              prompt: {
                id: "pmpt_696dd9fba1148195a8f689a4da6ca7bd085fc16529f93b69",
              },
              instructions: storyInstructions,
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
