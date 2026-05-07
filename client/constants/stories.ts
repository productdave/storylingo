export interface Story {
  id: string;
  title: string;
  description: string;
  context: string;
  image: any;
  macroBeats: string[];
  isInteractive?: boolean;
  portalText?: string;
}

export interface ComingSoonStory {
  id: string;
  title: string;
  description: string;
}

export const COMING_SOON_STORIES: ComingSoonStory[] = [
  {
    id: "little-mermaid",
    title: "The Little Mermaid",
    description: "A mermaid princess dreams of life on land",
  },
  {
    id: "sleeping-beauty",
    title: "Sleeping Beauty",
    description: "A princess cursed to sleep for 100 years",
  },
];

export const STORIES: Story[] = [
  {
    id: "your-adventure",
    title: "Your Adventure",
    description: "Create your own magical story with AI",
    context: "This is a special choose-your-own-adventure story where you decide what happens! The storyteller will ask you what kind of adventure you want, who you want to be, and where you want to go. Every choice you make shapes the story!",
    image: require("../../attached_assets/generated_images/your_adventure_story_card.png"),
    macroBeats: [
      "The storyteller welcomes you and asks what kind of adventure you'd like to have",
      "You choose your character - who will you be in this story?",
      "You decide where your adventure takes place - a magical forest, an underwater kingdom, outer space, or somewhere else",
      "Your adventure begins with an exciting discovery or meeting",
      "You face your first choice that changes the direction of the story",
      "A challenge or puzzle appears that you must solve your way",
      "You make a new friend or ally who joins your adventure",
      "The big moment arrives - how will you face it?",
      "Your choices lead to a unique and satisfying ending",
      "The storyteller celebrates your adventure and asks if you'd like another"
    ],
    isInteractive: true,
  },
  {
    id: "snow-white",
    title: "Snow White",
    description: "A princess, seven dwarfs, and a magical adventure",
    context: "In a faraway kingdom, there lived a beautiful princess named Snow White with skin as white as snow, lips as red as roses, and hair as black as ebony. Her stepmother, the Queen, was the most vain woman in all the land and owned a magic mirror that always told the truth.",
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
    context: "Long ago, a couple longed for a child. When a baby girl was finally born, an enchantress took her away and locked her in a tall tower deep in the forest. The girl was named Rapunzel, and she had the most beautiful, magical golden hair that grew longer and longer with each passing year.",
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
    context: "In London, the Darling children—Wendy, John, and Michael—were tucked into their nursery beds. Little did they know that a magical boy named Peter Pan, who never grows up, was about to fly through their window and invite them on the adventure of a lifetime to a place called Neverland.",
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
