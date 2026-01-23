import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSubscription } from '@/context/SubscriptionContext';
import { StoryBuddyColors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import type { RootStackParamList } from '@/navigation/RootStackNavigator';

type PaywallRouteProp = RouteProp<RootStackParamList, 'Paywall'>;

const PLANS = [
  {
    id: 'annual' as const,
    name: 'Annual',
    price: '$99',
    priceDetail: '$8.25/month',
    savings: 'Save 17%',
    recommended: true,
  },
  {
    id: 'monthly' as const,
    name: 'Monthly',
    price: '$9.99',
    priceDetail: 'per month',
    recommended: false,
  },
];

const FEATURES = [
  { icon: 'book-open', text: 'Unlimited stories' },
  { icon: 'layers', text: 'All story collections' },
  { icon: 'gift', text: '30 bonus days free' },
  { icon: 'x-circle', text: 'Cancel anytime' },
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<PaywallRouteProp>();
  const { subscribe, isTrialExpired, dailyLimitReached } = useSubscription();
  
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [isLoading, setIsLoading] = useState(false);

  const fromDailyLimit = route.params?.fromDailyLimit ?? false;
  const canDismiss = true; // Always allow users to go back

  const handleSelectPlan = (planId: 'monthly' | 'annual') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlan(planId);
  };

  const handleSubscribe = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    
    try {
      await subscribe(selectedPlan);
      navigation.replace('SubscriptionSuccess', { plan: selectedPlan });
    } catch (error) {
      console.error('Failed to subscribe:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!canDismiss) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleRestore = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const getHeaderContent = () => {
    if (isTrialExpired) {
      return {
        icon: 'clock' as const,
        title: "Your Trial Has Ended",
        subtitle: "Subscribe now to continue enjoying unlimited magical stories",
      };
    }
    if (fromDailyLimit || dailyLimitReached) {
      return {
        icon: 'zap' as const,
        title: "You've Reached Today's Limit",
        subtitle: "Get 30 days free when you subscribe!",
      };
    }
    return {
      icon: 'star' as const,
      title: "Unlock Unlimited Stories",
      subtitle: "Get 30 days free when you subscribe!",
    };
  };

  const headerContent = getHeaderContent();

  return (
    <LinearGradient
      colors={['#E8DEFF', '#F8F5FF', '#FFE8F0']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {canDismiss ? (
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Feather name="x" size={24} color={StoryBuddyColors.textSecondary} />
          </Pressable>
        ) : null}

        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
          <View style={styles.iconContainer}>
            <Feather name={headerContent.icon} size={48} color={StoryBuddyColors.primary} />
          </View>
          <Text style={styles.title}>{headerContent.title}</Text>
          <Text style={styles.subtitle}>{headerContent.subtitle}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.featuresContainer}>
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIconContainer}>
                <Feather name={feature.icon as any} size={20} color={StoryBuddyColors.primary} />
              </View>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.plansContainer}>
          {PLANS.map((plan) => (
            <Pressable
              key={plan.id}
              style={[
                styles.planCard,
                selectedPlan === plan.id && styles.planCardSelected,
                plan.recommended && styles.planCardRecommended,
              ]}
              onPress={() => handleSelectPlan(plan.id)}
            >
              {plan.recommended ? (
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedText}>BEST VALUE</Text>
                </View>
              ) : null}
              
              <View style={styles.planRadio}>
                <View style={[
                  styles.radioOuter,
                  selectedPlan === plan.id && styles.radioOuterSelected,
                ]}>
                  {selectedPlan === plan.id ? (
                    <View style={styles.radioInner} />
                  ) : null}
                </View>
              </View>
              
              <View style={styles.planInfo}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPriceDetail}>{plan.priceDetail}</Text>
                {plan.savings ? (
                  <Text style={styles.planSavings}>{plan.savings}</Text>
                ) : null}
              </View>
              
              <Text style={styles.planPrice}>{plan.price}</Text>
            </Pressable>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.ctaContainer}>
          <Pressable
            style={[styles.ctaButton, isLoading && styles.ctaButtonDisabled]}
            onPress={handleSubscribe}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>Start 30-Day Free Trial</Text>
            )}
          </Pressable>
          <Text style={styles.ctaSubtext}>
            Then {selectedPlan === 'annual' ? '$99/year' : '$9.99/month'}. Cancel anytime.
          </Text>

          <Pressable onPress={handleRestore} style={styles.restoreButton}>
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </Pressable>
        </Animated.View>

        <Text style={styles.legalText}>
          Payment will be charged to your Apple ID account at confirmation of purchase. 
          Subscription automatically renews unless canceled at least 24 hours before the end of the current period.
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    padding: Spacing.sm,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginTop: Spacing['3xl'],
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 107, 157, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h2,
    color: StoryBuddyColors.textPrimary,
    textAlign: 'center',
    fontFamily: 'FredokaOne_400Regular',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: StoryBuddyColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  bonusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: StoryBuddyColors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  bonusBannerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  featuresContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  featureIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 107, 157, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  featureText: {
    ...Typography.body,
    color: StoryBuddyColors.textPrimary,
    fontWeight: '500',
  },
  plansContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardSelected: {
    borderColor: StoryBuddyColors.primary,
    backgroundColor: 'rgba(255, 107, 157, 0.08)',
  },
  planCardRecommended: {
    position: 'relative',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    right: Spacing.lg,
    backgroundColor: StoryBuddyColors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  recommendedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  planRadio: {
    marginRight: Spacing.md,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: StoryBuddyColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: StoryBuddyColors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: StoryBuddyColors.primary,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    ...Typography.body,
    fontWeight: '600',
    color: StoryBuddyColors.textPrimary,
  },
  planPriceDetail: {
    ...Typography.small,
    color: StoryBuddyColors.textSecondary,
  },
  planSavings: {
    ...Typography.small,
    color: StoryBuddyColors.success,
    fontWeight: '600',
  },
  planPrice: {
    ...Typography.h3,
    color: StoryBuddyColors.textPrimary,
    fontWeight: '700',
  },
  ctaContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  ctaButton: {
    backgroundColor: StoryBuddyColors.primary,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['3xl'],
    borderRadius: BorderRadius.xl,
    width: '100%',
    alignItems: 'center',
    shadowColor: StoryBuddyColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaButtonDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    ...Typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  ctaSubtext: {
    ...Typography.small,
    color: StoryBuddyColors.textSecondary,
    marginTop: Spacing.sm,
  },
  restoreButton: {
    marginTop: Spacing.lg,
    padding: Spacing.sm,
  },
  restoreText: {
    ...Typography.small,
    color: StoryBuddyColors.primary,
    fontWeight: '500',
  },
  legalText: {
    fontSize: 11,
    lineHeight: 16,
    color: StoryBuddyColors.textSecondary,
    textAlign: 'center',
    opacity: 0.7,
  },
});
