export interface Story {
  id: string;
  title: string;
  description: string;
  image: any;
  macroBeats: string[];
}

export const STORIES: Story[] = [
  {
    id: "snow-white",
    title: "Snow White",
    description: "A princess, seven dwarfs, and a magical adventure",
    image: require("../../attached_assets/generated_images/snow_white_story_card.png"),
    macroBeats: [
      "Snow White lives with her stepmother the Queen, who is jealous of her beauty",
      "The Queen orders Snow White sent away; Snow White escapes into the forest",
      "Snow White discovers the cottage of the seven dwarfs and becomes their friend",
      "The Queen discovers Snow White is alive and disguises herself",
      "The Queen tricks Snow White with a poisoned apple; Snow White falls into a deep sleep",
      "The dwarfs find Snow White asleep and protect her",
      "A kind prince arrives and wakes Snow White with true love's kindness",
      "Snow White and her friends live happily ever after; the Queen is defeated",
    ],
  },
  {
    id: "rapunzel",
    title: "Rapunzel",
    description: "A girl with magical hair in a tall tower",
    image: require("../../attached_assets/generated_images/rapunzel_story_card.png"),
    macroBeats: [
      "A baby named Rapunzel is taken by an enchantress and locked in a tall tower",
      "Rapunzel grows up with magical long golden hair; she dreams of seeing the world",
      "A young prince hears Rapunzel singing and discovers the tower",
      "The prince visits Rapunzel secretly; they become friends and plan her escape",
      "The enchantress discovers the prince's visits and sends Rapunzel away",
      "The prince searches for Rapunzel despite many challenges",
      "The prince finds Rapunzel; her tears of joy heal him",
      "Rapunzel and the prince return together; they live happily ever after",
    ],
  },
  {
    id: "peter-pan",
    title: "Peter Pan",
    description: "Fly to Neverland with the boy who never grows up",
    image: require("../../attached_assets/generated_images/peter_pan_story_card.png"),
    macroBeats: [
      "Peter Pan visits the Darling children and invites them to Neverland",
      "The children learn to fly with fairy dust and travel to Neverland",
      "They arrive in Neverland and meet the Lost Boys and Tinker Bell",
      "The children explore Neverland's wonders: mermaids, forests, and adventure",
      "Captain Hook captures some of the group; a rescue mission begins",
      "Peter Pan battles Captain Hook to save his friends",
      "Hook is defeated; the children celebrate their victory",
      "The Darling children return home safely; Peter Pan remains their friend forever",
    ],
  },
];

export const STORYTELLER_PROMPT = `You are a voice-first, interactive storyteller for children aged 3–10. The child speaks, not types. Your job is to tell a classic public domain folktale as an interactive story, where the child is included as a helper or participant. The story must always follow the major plot events and ending as told in the original tale (macro story direction), but the child can make small choices that affect details or how their character acts.

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
