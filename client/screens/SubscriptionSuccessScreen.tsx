import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { StoryBuddyColors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import type { RootStackParamList } from '@/navigation/RootStackNavigator';

type SuccessRouteProp = RouteProp<RootStackParamList, 'SubscriptionSuccess'>;

const BENEFITS = [
  { icon: 'book-open', title: 'Unlimited Stories', subtitle: 'Access all tales' },
  { icon: 'star', title: 'Premium Content', subtitle: 'Exclusive adventures' },
  { icon: 'download-cloud', title: 'Offline Mode', subtitle: 'Listen anywhere' },
  { icon: 'users', title: 'Family Sharing', subtitle: 'Up to 5 profiles' },
];

export default function SubscriptionSuccessScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<SuccessRouteProp>();
  
  const plan = route.params?.plan ?? 'trial';
  
  const getTitle = () => {
    switch (plan) {
      case 'trial':
        return 'Your Trial Has Started!';
      case 'monthly':
        return 'Welcome to Premium!';
      case 'annual':
        return 'Welcome to Premium!';
      default:
        return 'Welcome!';
    }
  };

  const getSubtitle = () => {
    switch (plan) {
      case 'trial':
        return 'Enjoy 30 days of unlimited magical stories';
      default:
        return 'Your magical storytelling adventure begins now';
    }
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('StorySelection');
  };

  return (
    <LinearGradient
      colors={['#E8DEFF', '#F8F5FF', '#FFE8F0']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + Spacing['4xl'], paddingBottom: insets.bottom + Spacing.xl }]}>
        <Animated.View entering={ZoomIn.delay(200).springify()} style={styles.iconContainer}>
          <LinearGradient
            colors={['#FFD93D', '#FFA500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconGradient}
          >
            <Feather name="award" size={48} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(400).springify()} style={styles.title}>
          {getTitle()}
        </Animated.Text>
        
        <Animated.Text entering={FadeInDown.delay(500).springify()} style={styles.subtitle}>
          {getSubtitle()}
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(600).springify()} style={styles.benefitsGrid}>
          {BENEFITS.map((benefit, index) => (
            <Animated.View
              key={index}
              entering={FadeInDown.delay(700 + index * 100).springify()}
              style={styles.benefitCard}
            >
              <View style={styles.benefitIconContainer}>
                <Feather name={benefit.icon as any} size={24} color={StoryBuddyColors.primary} />
              </View>
              <Text style={styles.benefitTitle}>{benefit.title}</Text>
              <Text style={styles.benefitSubtitle}>{benefit.subtitle}</Text>
            </Animated.View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(1000).springify()} style={styles.ctaContainer}>
          <Pressable style={styles.ctaButton} onPress={handleContinue}>
            <Text style={styles.ctaText}>Start Exploring</Text>
            <Feather name="arrow-right" size={20} color="#FFFFFF" style={styles.ctaIcon} />
          </Pressable>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: Spacing.xl,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFA500',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
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
    marginBottom: Spacing['3xl'],
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing['3xl'],
  },
  benefitCard: {
    width: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  benefitIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 107, 157, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  benefitTitle: {
    ...Typography.small,
    fontWeight: '600',
    color: StoryBuddyColors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  benefitSubtitle: {
    fontSize: 12,
    color: StoryBuddyColors.textSecondary,
    textAlign: 'center',
  },
  ctaContainer: {
    width: '100%',
    marginTop: 'auto',
  },
  ctaButton: {
    backgroundColor: StoryBuddyColors.primary,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['3xl'],
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: StoryBuddyColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    ...Typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  ctaIcon: {
    marginLeft: Spacing.sm,
  },
});
