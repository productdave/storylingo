// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";

// server/languageConfig.ts
var DEFAULT_PROMPT_ID = "pmpt_696e819d09748196a4517a7b3e42c4560613f6be24ce5faa";
var languageConfigs = {
  en: {
    promptId: DEFAULT_PROMPT_ID,
    voice: "alloy",
    languageInstruction: `IMPORTANT: This is an IMMERSIVE LANGUAGE LEARNING experience for children ages 3-5. 
Speak ONLY in English for this entire session - no translations or explanations in other languages.
Use very simple vocabulary and short sentences appropriate for toddlers.
Repeat key words naturally to help children learn them.
Speak slowly and clearly with enthusiasm.
Use lots of expression, sound effects, and encourage children to repeat words and phrases.`,
    languageName: "English"
  },
  zh: {
    promptId: DEFAULT_PROMPT_ID,
    voice: "alloy",
    languageInstruction: `IMPORTANT: This is an IMMERSIVE LANGUAGE LEARNING experience for children ages 3-5.
Speak ONLY in Chinese (Mandarin) for this entire session - no translations or explanations in other languages.
Use very simple vocabulary and short sentences appropriate for toddlers.
Repeat key words naturally to help children learn them.
Speak slowly and clearly with enthusiasm.
Use lots of expression, sound effects, and encourage children to repeat words and phrases.`,
    languageName: "Chinese (Mandarin)"
  },
  es: {
    promptId: DEFAULT_PROMPT_ID,
    voice: "alloy",
    languageInstruction: `IMPORTANT: This is an IMMERSIVE LANGUAGE LEARNING experience for children ages 3-5.
Speak ONLY in Spanish for this entire session - no translations or explanations in other languages.
Use very simple vocabulary and short sentences appropriate for toddlers.
Repeat key words naturally to help children learn them.
Speak slowly and clearly with enthusiasm.
Use lots of expression, sound effects, and encourage children to repeat words and phrases.`,
    languageName: "Spanish"
  }
};
function getLanguageConfig(language) {
  if (language in languageConfigs) {
    return languageConfigs[language];
  }
  return languageConfigs.en;
}

// server/routes.ts
import * as fs from "fs";
import * as path from "path";
var INTERACTIVE_STORY_CONTEXT = `This is an interactive choose-your-own-adventure story. Unlike pre-written tales, YOU will create a unique story based entirely on the child's choices.

INTERACTIVE STORYTELLING RULES:
1. At every turn, give the child meaningful choices that genuinely affect the story direction
2. Never follow a predetermined plot - let the child's imagination guide where the story goes
3. Build the story world based on what the child wants: their character, setting, companions, and challenges
4. Make choices feel impactful - if they choose to befriend a dragon, the story should center on that friendship
5. Create surprise and delight based on their choices - reward creative ideas with magical outcomes
6. Keep the tone playful and empowering - the child is the hero and their choices matter
7. Use open-ended questions like "What do you want to do?" alongside specific choices
8. Remember and reference earlier choices to create a cohesive narrative

The macro beats are flexible guidelines, not strict plot points. Adapt them to whatever adventure the child chooses to create.`;
async function registerRoutes(app2) {
  app2.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app2.get("/cover", (req, res) => {
    const templatePath = path.resolve(process.cwd(), "server", "templates", "cover-image.html");
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });
  app2.post("/api/token", async (req, res) => {
    try {
      const { storyId, storyTitle, storyContext, macroBeats, language, isInteractive } = req.body;
      if (!storyId || !storyTitle || !macroBeats) {
        return res.status(400).json({ error: "Missing story information" });
      }
      const langConfig = getLanguageConfig(language || "en");
      const storyBeatsFormatted = macroBeats.map((beat, i) => `${i + 1}. ${beat}`).join("\n");
      let enhancedContext = langConfig.languageInstruction;
      if (isInteractive) {
        enhancedContext += `

${INTERACTIVE_STORY_CONTEXT}

${storyContext || "An open-ended adventure where the child creates their own story."}`;
      } else {
        enhancedContext += `

${storyContext || `A classic tale of ${storyTitle}`}`;
      }
      console.log("=== Token Request ===");
      console.log("Story Title:", storyTitle);
      console.log("Story Context:", enhancedContext);
      console.log("Story Beats:", storyBeatsFormatted);
      console.log("Language:", language || "en");
      console.log("Language Config:", langConfig.languageName);
      console.log("Prompt ID:", langConfig.promptId);
      const response = await fetch(
        "https://api.openai.com/v1/realtime/client_secrets",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            session: {
              type: "realtime",
              model: "gpt-realtime",
              prompt: {
                id: langConfig.promptId,
                variables: {
                  story_title: { type: "input_text", text: storyTitle },
                  story_context: { type: "input_text", text: enhancedContext },
                  story_beats: { type: "input_text", text: storyBeatsFormatted }
                }
              }
            }
          })
        }
      );
      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI Realtime client_secrets error:", errorText);
        return res.status(response.status).json({
          error: "Failed to create realtime session",
          details: errorText
        });
      }
      const data = await response.json();
      res.json({
        client_secret: data.value,
        expires_at: data.expires_at
      });
    } catch (error) {
      console.error("Token generation error:", error);
      res.status(500).json({ error: "Failed to generate token" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs2 from "fs";
import * as path2 from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path3 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path3.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path2.resolve(process.cwd(), "app.json");
    const appJsonContent = fs2.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, req, res) {
  const manifestPath = path2.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs2.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifestContent = fs2.readFileSync(manifestPath, "utf-8");
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const currentBaseUrl = `${protocol}://${host}`;
  const urlPattern = /https?:\/\/[^/\s"]+/g;
  const rewrittenManifest = manifestContent.replace(urlPattern, (match) => {
    try {
      const url = new URL(match);
      return `${currentBaseUrl}${url.pathname}`;
    } catch {
      return match;
    }
  });
  res.send(rewrittenManifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path2.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs2.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  const webDistPath = path2.resolve(process.cwd(), "dist");
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, req, res);
    }
    if (req.path === "/") {
      const webIndexPath = path2.join(webDistPath, "index.html");
      if (fs2.existsSync(webIndexPath)) {
        return res.sendFile(webIndexPath);
      }
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use(express.static(webDistPath));
  app2.use("/assets", express.static(path2.resolve(process.cwd(), "assets")));
  app2.use(express.static(path2.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
