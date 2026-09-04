import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { nextThinkGuessProgress } from "@/lib/thinkGuessProgress";

const STORAGE_KEY = "@storylingo_progress";

export interface ConversationMessage {
  role: "ai" | "user";
  text: string;
  timestamp: number;
}

interface StoryProgress {
  completedAt: string | null;
  sessionsCount: number;
  lastSessionAt: string | null;
  transcript: ConversationMessage[];
}

export interface ThinkGuessRoundSummary {
  solved: boolean;
  abandoned: boolean;
  usefulQuestions: number;
  hintsUsed: number;
  dontKnowCount: number;
}

export interface ThinkGuessProgress {
  languageLevel: number;
  reasoningLevel: number;
  roundsPlayed: number;
  roundsSolved: number;
  usefulQuestions: number;
  hintsUsed: number;
  successfulRoundStreak: number;
  strugglingRoundStreak: number;
  lastPlayedAt: string | null;
}

interface ProgressData {
  stories: Record<string, StoryProgress>;
  thinkGuess: ThinkGuessProgress;
}

interface ProgressContextType {
  isLoading: boolean;
  getStoryProgress: (storyId: string) => StoryProgress;
  isStoryCompleted: (storyId: string) => boolean;
  getCompletedStoryIds: () => string[];
  markStoryCompleted: (storyId: string) => Promise<void>;
  addSession: (storyId: string) => Promise<void>;
  saveTranscript: (
    storyId: string,
    messages: ConversationMessage[],
  ) => Promise<void>;
  getThinkGuessProgress: () => ThinkGuessProgress;
  recordThinkGuessRound: (
    summary: ThinkGuessRoundSummary,
  ) => Promise<ThinkGuessProgress>;
}

const defaultStoryProgress: StoryProgress = {
  completedAt: null,
  sessionsCount: 0,
  lastSessionAt: null,
  transcript: [],
};

const defaultData: ProgressData = {
  stories: {},
  thinkGuess: {
    languageLevel: 1,
    reasoningLevel: 2,
    roundsPlayed: 0,
    roundsSolved: 0,
    usefulQuestions: 0,
    hintsUsed: 0,
    successfulRoundStreak: 0,
    strugglingRoundStreak: 0,
    lastPlayedAt: null,
  },
};

const ProgressContext = createContext<ProgressContextType | undefined>(
  undefined,
);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ProgressData>(defaultData);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ProgressData>;
        setData({
          stories: parsed.stories ?? {},
          thinkGuess: {
            ...defaultData.thinkGuess,
            ...(parsed.thinkGuess ?? {}),
          },
        });
      }
    } catch (error) {
      console.error("Failed to load progress data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveData = async (newData: ProgressData) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      setData(newData);
    } catch (error) {
      console.error("Failed to save progress data:", error);
    }
  };

  const getStoryProgress = useCallback(
    (storyId: string): StoryProgress => {
      return data.stories[storyId] || defaultStoryProgress;
    },
    [data],
  );

  const isStoryCompleted = useCallback(
    (storyId: string): boolean => {
      return data.stories[storyId]?.completedAt != null;
    },
    [data],
  );

  const getCompletedStoryIds = useCallback((): string[] => {
    return Object.entries(data.stories)
      .filter(([_, progress]) => progress.completedAt != null)
      .map(([id]) => id);
  }, [data]);

  const markStoryCompleted = useCallback(
    async (storyId: string) => {
      const existing = data.stories[storyId] || defaultStoryProgress;
      if (existing.completedAt) return;

      const newData: ProgressData = {
        ...data,
        stories: {
          ...data.stories,
          [storyId]: {
            ...existing,
            completedAt: new Date().toISOString(),
          },
        },
      };
      await saveData(newData);
    },
    [data],
  );

  const addSession = useCallback(
    async (storyId: string) => {
      const existing = data.stories[storyId] || defaultStoryProgress;
      const newData: ProgressData = {
        ...data,
        stories: {
          ...data.stories,
          [storyId]: {
            ...existing,
            sessionsCount: existing.sessionsCount + 1,
            lastSessionAt: new Date().toISOString(),
          },
        },
      };
      await saveData(newData);
    },
    [data],
  );

  const saveTranscript = useCallback(
    async (storyId: string, messages: ConversationMessage[]) => {
      const existing = data.stories[storyId] || defaultStoryProgress;
      const newData: ProgressData = {
        ...data,
        stories: {
          ...data.stories,
          [storyId]: {
            ...existing,
            transcript: messages,
          },
        },
      };
      await saveData(newData);
    },
    [data],
  );

  const getThinkGuessProgress = useCallback((): ThinkGuessProgress => {
    return data.thinkGuess ?? defaultData.thinkGuess;
  }, [data]);

  const recordThinkGuessRound = useCallback(
    async (summary: ThinkGuessRoundSummary): Promise<ThinkGuessProgress> => {
      const existing = data.thinkGuess ?? defaultData.thinkGuess;
      const next = nextThinkGuessProgress(existing, summary);
      await saveData({ ...data, thinkGuess: next });
      return next;
    },
    [data],
  );

  return (
    <ProgressContext.Provider
      value={{
        isLoading,
        getStoryProgress,
        isStoryCompleted,
        getCompletedStoryIds,
        markStoryCompleted,
        addSession,
        saveTranscript,
        getThinkGuessProgress,
        recordThinkGuessRound,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (context === undefined) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }
  return context;
}
