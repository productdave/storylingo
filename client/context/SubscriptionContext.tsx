import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@storytale_subscription';

type SubscriptionStatus = 'none' | 'trial' | 'monthly' | 'annual';

interface SubscriptionData {
  status: SubscriptionStatus;
  trialStartDate: string | null;
  trialEndDate: string | null;
  subscriptionStartDate: string | null;
  hasSeenTrialPrompt: boolean;
}

interface SubscriptionContextType {
  status: SubscriptionStatus;
  isLoading: boolean;
  trialDaysRemaining: number;
  hasActiveSubscription: boolean;
  hasSeenTrialPrompt: boolean;
  startTrial: () => Promise<void>;
  subscribe: (plan: 'monthly' | 'annual') => Promise<void>;
  restorePurchases: () => Promise<boolean>;
  markTrialPromptSeen: () => Promise<void>;
  cancelSubscription: () => Promise<void>;
}

const defaultData: SubscriptionData = {
  status: 'none',
  trialStartDate: null,
  trialEndDate: null,
  subscriptionStartDate: null,
  hasSeenTrialPrompt: false,
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SubscriptionData>(defaultData);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SubscriptionData;
        const updatedData = checkAndUpdateTrialStatus(parsed);
        setData(updatedData);
        if (updatedData !== parsed) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
        }
      }
    } catch (error) {
      console.error('Failed to load subscription data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAndUpdateTrialStatus = (subscriptionData: SubscriptionData): SubscriptionData => {
    if (subscriptionData.status === 'trial' && subscriptionData.trialEndDate) {
      const now = new Date();
      const endDate = new Date(subscriptionData.trialEndDate);
      if (now > endDate) {
        return { ...subscriptionData, status: 'none' };
      }
    }
    return subscriptionData;
  };

  const saveData = async (newData: SubscriptionData) => {
    setData(newData);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  };

  const calculateTrialDaysRemaining = useCallback((): number => {
    if (data.status !== 'trial' || !data.trialEndDate) return 0;
    const now = new Date();
    const endDate = new Date(data.trialEndDate);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [data.status, data.trialEndDate]);

  const startTrial = async () => {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    await saveData({
      ...data,
      status: 'trial',
      trialStartDate: now.toISOString(),
      trialEndDate: trialEnd.toISOString(),
      hasSeenTrialPrompt: true,
    });
  };

  const subscribe = async (plan: 'monthly' | 'annual') => {
    await saveData({
      ...data,
      status: plan,
      subscriptionStartDate: new Date().toISOString(),
      hasSeenTrialPrompt: true,
    });
  };

  const restorePurchases = async (): Promise<boolean> => {
    return false;
  };

  const markTrialPromptSeen = async () => {
    await saveData({
      ...data,
      hasSeenTrialPrompt: true,
    });
  };

  const cancelSubscription = async () => {
    await saveData({
      ...data,
      status: 'none',
      subscriptionStartDate: null,
    });
  };

  const hasActiveSubscription = data.status === 'trial' || data.status === 'monthly' || data.status === 'annual';

  return (
    <SubscriptionContext.Provider
      value={{
        status: data.status,
        isLoading,
        trialDaysRemaining: calculateTrialDaysRemaining(),
        hasActiveSubscription,
        hasSeenTrialPrompt: data.hasSeenTrialPrompt,
        startTrial,
        subscribe,
        restorePurchases,
        markTrialPromptSeen,
        cancelSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
