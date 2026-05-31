import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { fetchCustomNutritionPlans, fetchWeeklyNutritionGuides } from '../api/nutrition';
import type { NutritionMacros, NutritionPlan } from '../types/nutrition';
import type { HomeStackParamList } from '../navigation/HomeNavigator';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Nutrition'>;

function parseApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string } } }).response?.data;
    if (typeof data?.message === 'string' && data.message) return data.message;
  }
  return fallback;
}

function MacroStat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View style={styles.macroStat}>
      <Text style={styles.macroValue}>
        {Math.round(value)}
        <Text style={styles.macroUnit}>{unit}</Text>
      </Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function MacroDashboard({ macros }: { macros: NutritionMacros }) {
  return (
    <View style={styles.macroGrid}>
      <MacroStat label="Calories" value={macros.calories} unit="" />
      <MacroStat label="Protein" value={macros.protein} unit="g" />
      <MacroStat label="Carbs" value={macros.carbs} unit="g" />
      <MacroStat label="Fats" value={macros.fats} unit="g" />
    </View>
  );
}

function MealCard({
  name,
  time,
  foodItems,
}: {
  name: string;
  time?: string;
  foodItems: string[];
}) {
  return (
    <View style={styles.mealCard}>
      <View style={styles.mealHeader}>
        <Text style={styles.mealName}>{name}</Text>
        {time ? <Text style={styles.mealTime}>{time}</Text> : null}
      </View>
      {foodItems.map((item) => (
        <View key={item} style={styles.foodRow}>
          <Ionicons name="ellipse" size={6} color="#667eea" />
          <Text style={styles.foodItem}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function CustomPlanSection({ plan }: { plan: NutritionPlan }) {
  return (
    <View style={styles.customPlanCard}>
      <Text style={styles.customPlanTitle}>{plan.title}</Text>
      {plan.description ? (
        <Text style={styles.customPlanDescription}>{plan.description}</Text>
      ) : null}

      {plan.macros ? <MacroDashboard macros={plan.macros} /> : null}

      {plan.meals && plan.meals.length > 0 ? (
        <View style={styles.mealsSection}>
          <Text style={styles.mealsSectionTitle}>Daily Meals</Text>
          {plan.meals.map((meal) => (
            <MealCard
              key={`${meal.name}-${meal.time ?? ''}`}
              name={meal.name}
              time={meal.time}
              foodItems={meal.foodItems}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function GuideCard({ plan }: { plan: NutritionPlan }) {
  const openAttachment = () => {
    if (!plan.fileUrl) return;
    Linking.openURL(plan.fileUrl).catch(() => {
      /* user cancelled or invalid URL */
    });
  };

  return (
    <View style={styles.guideCard}>
      <View style={styles.guideIconWrap}>
        <Ionicons name="document-text-outline" size={22} color="#667eea" />
      </View>
      <View style={styles.guideBody}>
        <Text style={styles.guideTitle}>{plan.title}</Text>
        {plan.description ? (
          <Text style={styles.guideDescription} numberOfLines={3}>
            {plan.description}
          </Text>
        ) : null}
        {plan.fileUrl ? (
          <TouchableOpacity style={styles.guideLink} onPress={openAttachment}>
            <Ionicons name="open-outline" size={14} color="#667eea" />
            <Text style={styles.guideLinkText}>View guide</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function LockedCustomSection({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <View style={styles.lockedCard}>
      <View style={styles.lockedOverlay}>
        <Ionicons name="lock-closed" size={28} color="#667eea" />
        <Text style={styles.lockedTitle}>Custom Macro Plan</Text>
        <Text style={styles.lockedBody}>
          Personalized macro targets and daily meals from your trainer are included with Active
          Client membership.
        </Text>
        <View style={styles.paymentsBanner}>
          <Ionicons name="card-outline" size={14} color="#92400e" />
          <Text style={styles.paymentsBannerText}>Secure payments launching soon via Stripe</Text>
        </View>
        <TouchableOpacity style={styles.upgradeButton} onPress={onUpgrade}>
          <Text style={styles.upgradeButtonText}>View Membership Options</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Client nutrition hub — weekly guides for all tiers; custom macro plans
 * for ACTIVE_CLIENT subscribers.
 */
export default function NutritionScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const isActiveClient = user?.subscriptionTier === 'ACTIVE_CLIENT';

  const [weeklyGuides, setWeeklyGuides] = useState<NutritionPlan[]>([]);
  const [customPlans, setCustomPlans] = useState<NutritionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadNutrition = useCallback(async () => {
    try {
      setLoadError(null);
      const weeklyPromise = fetchWeeklyNutritionGuides();
      const customPromise = isActiveClient
        ? fetchCustomNutritionPlans()
        : Promise.resolve([] as NutritionPlan[]);

      const [weekly, custom] = await Promise.all([weeklyPromise, customPromise]);
      setWeeklyGuides(weekly);
      setCustomPlans(custom);
    } catch (error) {
      console.error('Failed to load nutrition:', error);
      setLoadError(parseApiError(error, 'Could not load nutrition content.'));
    } finally {
      setLoading(false);
    }
  }, [isActiveClient]);

  useEffect(() => {
    loadNutrition();
  }, [loadNutrition]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNutrition();
    setRefreshing(false);
  };

  const goToUpgrade = () => {
    navigation.getParent()?.navigate('Profile', { screen: 'Upgrade' });
  };

  const primaryCustomPlan =
    customPlans.find((p) => p.planType === 'macro_plan') ?? customPlans[0] ?? null;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
      }
    >
      {loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity onPress={loadNutrition}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isActiveClient ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Custom Meal Plan</Text>
          {primaryCustomPlan ? (
            <CustomPlanSection plan={primaryCustomPlan} />
          ) : (
            <View style={styles.emptyCustom}>
              <Ionicons name="restaurant-outline" size={40} color="#ccc" />
              <Text style={styles.emptyCustomTitle}>Your plan is being prepared</Text>
              <Text style={styles.emptyCustomBody}>
                Your trainer is building your custom meal plan. You will see macro targets and
                daily meals here as soon as it is published to your account.
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.section}>
          <LockedCustomSection onUpgrade={goToUpgrade} />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General Guides & Tips</Text>
        <Text style={styles.sectionSubtitle}>
          Nutrition resources from KingVision — available to all members.
        </Text>
        {weeklyGuides.length > 0 ? (
          weeklyGuides.map((plan) => <GuideCard key={plan._id} plan={plan} />)
        ) : (
          <View style={styles.emptyGuides}>
            <Ionicons name="nutrition-outline" size={36} color="#ccc" />
            <Text style={styles.emptyGuidesText}>No guides published yet. Check back soon.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#991b1b',
  },
  retryText: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '600',
    marginTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 14,
    lineHeight: 18,
  },
  customPlanCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  customPlanTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  customPlanDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
    lineHeight: 20,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  macroStat: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#667eea12',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#667eea',
  },
  macroUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  macroLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  mealsSection: {
    marginTop: 18,
  },
  mealsSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667eea',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  mealCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  mealTime: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '600',
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  foodItem: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  emptyCustom: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  emptyCustomTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#444',
    marginTop: 12,
  },
  emptyCustomBody: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  lockedCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
    minHeight: 180,
  },
  lockedOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 10,
  },
  lockedBody: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    marginBottom: 16,
  },
  upgradeButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  upgradeButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  paymentsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  paymentsBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    flex: 1,
  },
  guideCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  guideIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#667eea15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideBody: {
    flex: 1,
  },
  guideTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  guideDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    lineHeight: 18,
  },
  guideLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  guideLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667eea',
  },
  emptyGuides: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyGuidesText: {
    fontSize: 14,
    color: '#888',
    marginTop: 10,
    textAlign: 'center',
  },
});
