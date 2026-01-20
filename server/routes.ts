import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { getLanguageConfig } from "./languageConfig";

export async function registerRoutes(app: Express): Promise<Server> {
  // POST /api/token - Create an ephemeral client secret for OpenAI Realtime API (GA version)
  app.post("/api/token", async (req, res) => {
    try {
      const { storyId, storyTitle, storyContext, macroBeats, language } = req.body;

      if (!storyId || !storyTitle || !macroBeats) {
        return res.status(400).json({ error: "Missing story information" });
      }

      // Get language-specific configuration
      const langConfig = getLanguageConfig(language || "en");

      // Format story beats as a numbered list string
      const storyBeatsFormatted = macroBeats
        .map((beat: string, i: number) => `${i + 1}. ${beat}`)
        .join("\n");

      // Add language instruction to story context
      const enhancedContext = `${langConfig.languageInstruction}\n\n${storyContext || `A classic tale of ${storyTitle}`}`;

      // Log the variables being sent
      console.log("=== Token Request ===");
      console.log("Story Title:", storyTitle);
      console.log("Story Context:", enhancedContext);
      console.log("Story Beats:", storyBeatsFormatted);
      console.log("Language:", language || "en");
      console.log("Language Config:", langConfig.languageName);
      console.log("Prompt ID:", langConfig.promptId);

      // Create ephemeral client secret using OpenAI's GA Realtime endpoint
      // Uses the user's saved prompt ID from OpenAI dashboard
      // Pass story variables to be injected into the prompt template
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
              model: "gpt-realtime-mini",
              prompt: {
                id: langConfig.promptId,
                variables: {
                  story_title: { type: "input_text", text: storyTitle },
                  story_context: { type: "input_text", text: enhancedContext },
                  story_beats: { type: "input_text", text: storyBeatsFormatted },
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
