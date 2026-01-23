import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@storytale_subscription';
const DAILY_LIMIT_SECONDS = 900; // 15 minutes

type SubscriptionStatus = 'none' | 'free_trial' | 'extended_trial' | 'monthly' | 'annual';

interface SubscriptionData {
  status: SubscriptionStatus;
  freeTrialStartDate: string | null;
  freeTrialEndDate: string | null;
  extendedTrialStartDate: string | null;
  extendedTrialEndDate: string | null;
  subscriptionStartDate: string | null;
  dailyListenTimeSeconds: number;
  lastListenDate: string | null;
  totalListenTimeSeconds: number;
}

interface SubscriptionContextType {
  status: SubscriptionStatus;
  isLoading: boolean;
  trialDaysRemaining: number;
  hasActiveSubscription: boolean;
  dailyListenTimeSeconds: number;
  dailyLimitReached: boolean;
  dailyLimitSeconds: number;
  isTrialExpired: boolean;
  startExtendedTrial: () => Promise<void>;
  subscribe: (plan: 'monthly' | 'annual') => Promise<void>;
  restorePurchases: () => Promise<boolean>;
  addListenTime: (seconds: number) => Promise<void>;
  resetForTesting: () => Promise<void>;
  simulateExpiredTrial: () => Promise<void>;
}

const defaultData: SubscriptionData = {
  status: 'none',
  freeTrialStartDate: null,
  freeTrialEndDate: null,
  extendedTrialStartDate: null,
  extendedTrialEndDate: null,
  subscriptionStartDate: null,
  dailyListenTimeSeconds: 0,
  lastListenDate: null,
  totalListenTimeSeconds: 0,
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SubscriptionData>(defaultData);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const getTodayDateString = () => {
    return new Date().toISOString().split('T')[0];
  };

  const loadSubscriptionData = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SubscriptionData;
        let updatedData = migrateOldData(parsed);
        updatedData = checkAndUpdateTrialStatus(updatedData);
        updatedData = resetDailyLimitIfNewDay(updatedData);
        
        // If status is 'none' and no trial was ever started, start free trial
        if (updatedData.status === 'none' && !updatedData.freeTrialStartDate) {
          updatedData = startFreeTrial(updatedData);
        }
        
        setData(updatedData);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
      } else {
        const initialData = startFreeTrial(defaultData);
        setData(initialData);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
      }
    } catch (error) {
      console.error('Failed to load subscription data:', error);
      const initialData = startFreeTrial(defaultData);
      setData(initialData);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Migrate old subscription data format to new format
  const migrateOldData = (oldData: any): SubscriptionData => {
    // Handle old 'trial' status from previous implementation
    if (oldData.status === 'trial') {
      return {
        ...defaultData,
        ...oldData,
        status: 'free_trial',
        freeTrialStartDate: oldData.trialStartDate || oldData.freeTrialStartDate || new Date().toISOString(),
        freeTrialEndDate: oldData.trialEndDate || oldData.freeTrialEndDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }
    return { ...defaultData, ...oldData };
  };

  const startFreeTrial = (currentData: SubscriptionData): SubscriptionData => {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    return {
      ...currentData,
      status: 'free_trial',
      freeTrialStartDate: now.toISOString(),
      freeTrialEndDate: trialEnd.toISOString(),
      lastListenDate: getTodayDateString(),
    };
  };

  const resetDailyLimitIfNewDay = (subscriptionData: SubscriptionData): SubscriptionData => {
    const today = getTodayDateString();
    if (subscriptionData.lastListenDate !== today) {
      return {
        ...subscriptionData,
        dailyListenTimeSeconds: 0,
        lastListenDate: today,
      };
    }
    return subscriptionData;
  };

  const checkAndUpdateTrialStatus = (subscriptionData: SubscriptionData): SubscriptionData => {
    const now = new Date();
    
    if (subscriptionData.status === 'extended_trial' && subscriptionData.extendedTrialEndDate) {
      const endDate = new Date(subscriptionData.extendedTrialEndDate);
      if (now > endDate) {
        return { ...subscriptionData, status: 'none' };
      }
    }
    
    if (subscriptionData.status === 'free_trial' && subscriptionData.freeTrialEndDate) {
      const endDate = new Date(subscriptionData.freeTrialEndDate);
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
    if (data.status === 'free_trial' && data.freeTrialEndDate) {
      const now = new Date();
      const endDate = new Date(data.freeTrialEndDate);
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    }
    
    if (data.status === 'extended_trial' && data.extendedTrialEndDate) {
      const now = new Date();
      const endDate = new Date(data.extendedTrialEndDate);
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    }
    
    return 0;
  }, [data.status, data.freeTrialEndDate, data.extendedTrialEndDate]);

  const startExtendedTrial = async () => {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    await saveData({
      ...data,
      status: 'extended_trial',
      extendedTrialStartDate: now.toISOString(),
      extendedTrialEndDate: trialEnd.toISOString(),
      dailyListenTimeSeconds: 0,
    });
  };

  const subscribe = async (plan: 'monthly' | 'annual') => {
    await saveData({
      ...data,
      status: plan,
      subscriptionStartDate: new Date().toISOString(),
    });
  };

  const restorePurchases = async (): Promise<boolean> => {
    return false;
  };

  const addListenTime = async (seconds: number) => {
    const today = getTodayDateString();
    let updatedData = data;
    
    if (data.lastListenDate !== today) {
      updatedData = {
        ...data,
        dailyListenTimeSeconds: 0,
        lastListenDate: today,
      };
    }
    
    await saveData({
      ...updatedData,
      dailyListenTimeSeconds: updatedData.dailyListenTimeSeconds + seconds,
      totalListenTimeSeconds: updatedData.totalListenTimeSeconds + seconds,
      lastListenDate: today,
    });
  };

  const resetForTesting = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    const initialData = startFreeTrial(defaultData);
    setData(initialData);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
  };

  const simulateExpiredTrial = async () => {
    // Set free trial to have ended yesterday
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    
    const expiredData: SubscriptionData = {
      ...defaultData,
      status: 'none',
      freeTrialStartDate: twoDaysAgo.toISOString(),
      freeTrialEndDate: yesterday.toISOString(),
    };
    
    await saveData(expiredData);
  };

  const hasActiveSubscription = 
    data.status === 'free_trial' || 
    data.status === 'extended_trial' || 
    data.status === 'monthly' || 
    data.status === 'annual';
  
  const isTrialExpired = data.status === 'none' && 
    (data.freeTrialEndDate !== null || data.extendedTrialEndDate !== null);
  
  // Daily limit only applies to free_trial (before signing up for any plan)
  const dailyLimitReached = 
    data.status === 'free_trial' && 
    data.dailyListenTimeSeconds >= DAILY_LIMIT_SECONDS;

  return (
    <SubscriptionContext.Provider
      value={{
        status: data.status,
        isLoading,
        trialDaysRemaining: calculateTrialDaysRemaining(),
        hasActiveSubscription,
        dailyListenTimeSeconds: data.dailyListenTimeSeconds,
        dailyLimitReached,
        dailyLimitSeconds: DAILY_LIMIT_SECONDS,
        isTrialExpired,
        startExtendedTrial,
        subscribe,
        restorePurchases,
        addListenTime,
        resetForTesting,
        simulateExpiredTrial,
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
