export type Language = "en" | "zh";

export const translations = {
  en: {
    chooseYourStory: "Choose Your Story",
    stories: {
      "snow-white": {
        title: "Snow White",
        description: "A princess, seven dwarfs, and a magical adventure",
      },
      rapunzel: {
        title: "Rapunzel",
        description: "A girl with magical hair in a tall tower",
      },
      "peter-pan": {
        title: "Peter Pan",
        description: "Fly to Neverland with the boy who never grows up",
      },
    },
    session: {
      connecting: "Connecting...",
      listening: "Listening...",
      speaking: "Speaking...",
      paused: "Paused",
      muted: "Muted",
      connectionLost: "Connection lost",
      back: "Back",
      mute: "Mute",
      unmute: "Unmute",
    },
  },
  zh: {
    chooseYourStory: "选择你的故事",
    stories: {
      "snow-white": {
        title: "白雪公主",
        description: "一位公主、七个小矮人和一次神奇的冒险",
      },
      rapunzel: {
        title: "长发公主",
        description: "一个住在高塔里、拥有神奇长发的女孩",
      },
      "peter-pan": {
        title: "彼得潘",
        description: "和永远不会长大的男孩一起飞往梦幻岛",
      },
    },
    session: {
      connecting: "连接中...",
      listening: "聆听中...",
      speaking: "讲述中...",
      paused: "已暂停",
      muted: "已静音",
      connectionLost: "连接丢失",
      back: "返回",
      mute: "静音",
      unmute: "取消静音",
    },
  },
};

export function getTranslation(lang: Language) {
  return translations[lang];
}
