import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import ExerciseBuilder, {
  createDefaultExerciseList,
} from '../../components/Admin/ExerciseBuilder';
import NutritionBuilder, {
  EMPTY_NUTRITION_FORM,
  createDefaultMealList,
  type MealDraft,
  type NutritionFormState,
} from '../../components/Admin/NutritionBuilder';
import type {
  ContentKind,
  CreateWorkoutPayload,
  DistributionType,
  ExerciseDraft,
  AssignedClientSummary,
  Workout,
  WorkoutDifficulty,
  WorkoutType,
} from '../../types/workout';
import type { ActiveClientSummary } from '../../types/user';
import type {
  CreateNutritionPayload,
  NutritionAssignee,
  NutritionMeal,
  NutritionPlan,
} from '../../types/nutrition';
import {
  MUSCLE_GROUP_OPTIONS,
  MUSCLE_GROUP_PRESETS,
  findInvalidMuscleGroupTokens,
  resolveTargetMuscleGroups,
} from '../../constants/muscleGroups';
import type { AdminContentStackParamList } from '../../navigation/AdminContentNavigator';

type ContentStudioNav = NativeStackNavigationProp<AdminContentStackParamList, 'ContentStudio'>;

type ContentTab = 'workouts' | 'tutoring' | 'nutrition';

type FormState = {
  title: string;
  description: string;
  distributionType: DistributionType;
  videoUrl: string;
  duration: string;
  difficulty: WorkoutDifficulty;
  workoutType: WorkoutType;
  muscleFocus: string;
  intensity: string;
  volumeLoadIndex: string;
  cardiovascularStress: string;
  recoveryDemand: string;
};

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  distributionType: 'weekly_public',
  videoUrl: '',
  duration: '30',
  difficulty: 'beginner',
  workoutType: 'mixed',
  muscleFocus: 'full_body',
  intensity: '5',
  volumeLoadIndex: '0.5',
  cardiovascularStress: '5',
  recoveryDemand: '5',
};

const DIFFICULTY_OPTIONS: WorkoutDifficulty[] = ['beginner', 'intermediate', 'advanced'];
const WORKOUT_TYPE_OPTIONS: WorkoutType[] = [
  'mixed',
  'strength',
  'cardio',
  'hiit',
  'functional',
  'flexibility',
];

function parseApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string; errors?: unknown[] } } })
      .response?.data;
    if (typeof data?.message === 'string' && data.message) return data.message;
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      const first = data.errors[0];
      if (typeof first === 'object' && first !== null && 'msg' in first) {
        return String((first as { msg: string }).msg);
      }
    }
  }
  return fallback;
}

function formatPublishedLabel(item: Workout): string {
  const isTutoring = item.tags?.includes('tutoring');
  if (isTutoring) return 'Tutoring · Basic tier';
  if (item.isCustom) return 'Custom client';
  if (item.isPublic) return `Weekly public · W${item.weekNumber ?? '?'}`;
  return 'Published';
}

function formatExerciseCount(exercises?: unknown[]): string {
  const count = exercises?.length ?? 0;
  if (count === 0) return '';
  return `${count} exercise${count === 1 ? '' : 's'}`;
}

function formatAssigneeNames(item: Workout): string | null {
  const assignees = item.assignedTo ?? [];
  if (assignees.length === 0) return null;

  const names = assignees
    .map((assignee) => {
      if (typeof assignee === 'string') return null;
      const client = assignee as AssignedClientSummary;
      const fullName = [client.profile?.firstName, client.profile?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      return fullName || client.email;
    })
    .filter(Boolean);

  return names.length > 0 ? names.join(', ') : null;
}

function formatRecentStats(item: Workout): string {
  const parts: string[] = [];
  const exercisePart = formatExerciseCount(item.exercises);
  if (exercisePart) parts.push(exercisePart);
  parts.push(`${item.duration} min`);
  parts.push(item.difficulty);
  return parts.join(' · ');
}

function formatNutritionAssignees(plan: NutritionPlan): string {
  const list = plan.assignedTo ?? [];
  if (list.length === 0) return '';
  const names = list
    .map((assignee) => {
      if (typeof assignee === 'string') return null;
      const a = assignee as NutritionAssignee;
      const full = [a.firstName, a.lastName].filter(Boolean).join(' ').trim();
      return full || a.email;
    })
    .filter(Boolean);
  return names.length > 0 ? ` · Assigned to ${names.join(', ')}` : '';
}

/**
 * Admin Content Studio — publish weekly workouts and tutoring videos for Basic
 * tier clients. Workouts tab handles program content; Tutoring tab focuses on
 * video-first instructional assets.
 */
export default function AdminContentScreen() {
  const navigation = useNavigation<ContentStudioNav>();
  const [contentTab, setContentTab] = useState<ContentTab>('workouts');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [exercises, setExercises] = useState<ExerciseDraft[]>(createDefaultExerciseList);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activeClients, setActiveClients] = useState<ActiveClientSummary[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentItems, setRecentItems] = useState<Workout[]>([]);

  const [nutritionForm, setNutritionForm] = useState<NutritionFormState>(EMPTY_NUTRITION_FORM);
  const [meals, setMeals] = useState<MealDraft[]>(createDefaultMealList);
  const [recentNutrition, setRecentNutrition] = useState<NutritionPlan[]>([]);

  const contentKind: ContentKind = contentTab === 'tutoring' ? 'tutoring' : 'workout';

  const patchForm = (patch: Partial<FormState>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.distributionType === 'weekly_public') {
        setSelectedClientId(null);
      }
      return next;
    });
  };

  const loadActiveClients = useCallback(async () => {
    try {
      setLoadingClients(true);
      const response = await api.get<{ success: boolean; data: ActiveClientSummary[] }>(
        '/users/active-clients'
      );
      setActiveClients(response.data.data ?? []);
    } catch (error) {
      console.error('Failed to load active clients:', error);
      setActiveClients([]);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    if (contentTab === 'workouts' && form.distributionType === 'custom_client') {
      loadActiveClients();
    }
    if (contentTab === 'nutrition' && nutritionForm.distributionType === 'custom_client') {
      loadActiveClients();
    }
  }, [contentTab, form.distributionType, nutritionForm.distributionType, loadActiveClients]);

  const loadRecent = useCallback(async () => {
    try {
      if (contentTab === 'nutrition') {
        const response = await api.get<{ success: boolean; data: NutritionPlan[] }>(
          '/nutrition/admin/recent',
          { params: { limit: 8 } }
        );
        setRecentNutrition(response.data.data ?? []);
        return;
      }
      const kind = contentTab === 'tutoring' ? 'tutoring' : 'workout';
      const response = await api.get<{ success: boolean; data: Workout[] }>(
        '/workouts/published',
        { params: { limit: 8, kind } }
      );
      setRecentItems(response.data.data ?? []);
    } catch (error) {
      console.error('Failed to load recent content:', error);
    } finally {
      setLoadingRecent(false);
    }
  }, [contentTab]);

  useEffect(() => {
    setLoadingRecent(true);
    loadRecent();
  }, [loadRecent]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRecent();
    setRefreshing(false);
  }, [loadRecent]);

  const patchNutritionForm = (patch: Partial<NutritionFormState>) => {
    setNutritionForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.distributionType === 'weekly_public') {
        setSelectedClientId(null);
      }
      return next;
    });
  };

  const handlePublishNutrition = async () => {
    if (!nutritionForm.title.trim() || !nutritionForm.description.trim()) {
      Alert.alert('Check the form', 'Title and description are required.');
      return;
    }

    const isCustom = nutritionForm.distributionType === 'custom_client';
    if (isCustom && !selectedClientId) {
      Alert.alert('Assign client', 'Select an Active Client to receive this plan.');
      return;
    }

    const isMacroPlan = nutritionForm.planType === 'macro_plan';
    const payload: CreateNutritionPayload = {
      title: nutritionForm.title.trim(),
      description: nutritionForm.description.trim(),
      distributionType: nutritionForm.distributionType,
      planType: nutritionForm.planType,
      fileUrl:
        !isMacroPlan && nutritionForm.fileUrl.trim() ? nutritionForm.fileUrl.trim() : undefined,
      assignedTo: isCustom && selectedClientId ? [selectedClientId] : undefined,
    };

    if (isMacroPlan) {
      const macros = {
        calories: Number(nutritionForm.calories),
        protein: Number(nutritionForm.protein),
        carbs: Number(nutritionForm.carbs),
        fats: Number(nutritionForm.fats),
      };
      if (
        ![macros.calories, macros.protein, macros.carbs, macros.fats].every(
          (n) => Number.isFinite(n) && n >= 0
        )
      ) {
        Alert.alert('Check the form', 'Macros must be valid non-negative numbers.');
        return;
      }

      const mealPayload: NutritionMeal[] = [];
      for (let i = 0; i < meals.length; i += 1) {
        const meal = meals[i];
        if (!meal.name.trim()) {
          Alert.alert('Check the form', `Meal ${i + 1}: name is required.`);
          return;
        }
        const items = meal.foodItems
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (items.length === 0) {
          Alert.alert('Check the form', `Meal ${i + 1}: add at least one food item.`);
          return;
        }
        mealPayload.push({
          name: meal.name.trim(),
          time: meal.time.trim() || undefined,
          foodItems: items,
        });
      }

      payload.macros = macros;
      payload.meals = mealPayload;
    }

    try {
      setPublishing(true);
      await api.post('/nutrition', payload);
      Alert.alert(
        'Published',
        isCustom
          ? 'Custom macro plan delivered to the assigned client.'
          : 'General nutrition guide is live for Basic-tier clients.'
      );
      setNutritionForm({ ...EMPTY_NUTRITION_FORM });
      setMeals(createDefaultMealList());
      setSelectedClientId(null);
      await loadRecent();
    } catch (error) {
      Alert.alert('Publish failed', parseApiError(error, 'Could not publish plan.'));
    } finally {
      setPublishing(false);
    }
  };

  const validateForm = (): string | null => {
    if (!form.title.trim()) return 'Title is required.';
    if (!form.description.trim()) return 'Description is required.';
    const duration = parseInt(form.duration, 10);
    if (!Number.isFinite(duration) || duration < 5 || duration > 240) {
      return 'Duration must be between 5 and 240 minutes.';
    }
    if (contentTab === 'tutoring' && !form.videoUrl.trim()) {
      return 'Video URL is required for tutoring videos.';
    }
    if (form.videoUrl.trim()) {
      try {
        // eslint-disable-next-line no-new
        new URL(form.videoUrl.trim());
      } catch {
        return 'Video URL must be a valid URL (https://...).';
      }
    }
    const invalidMuscleTokens = findInvalidMuscleGroupTokens(form.muscleFocus);
    if (invalidMuscleTokens.length > 0) {
      return `Invalid muscle group(s): ${invalidMuscleTokens.join(', ')}. Use presets below or values like chest, back, full_body, upper_body.`;
    }
    if (contentTab === 'workouts') {
      if (form.distributionType === 'custom_client' && !selectedClientId) {
        return 'Select an Active Client to assign this workout to.';
      }
      if (exercises.length === 0) {
        return 'Add at least one exercise.';
      }
      for (let i = 0; i < exercises.length; i += 1) {
        const exercise = exercises[i];
        if (!exercise.name.trim()) {
          return `Exercise ${i + 1}: name is required.`;
        }
        const sets = parseInt(exercise.sets, 10);
        if (!Number.isFinite(sets) || sets < 1) {
          return `Exercise ${i + 1}: sets must be at least 1.`;
        }
        if (!exercise.targetValue.trim()) {
          return `Exercise ${i + 1}: ${
            exercise.targetType === 'duration' ? 'target seconds' : 'reps'
          } are required.`;
        }
        if (exercise.targetType === 'duration') {
          const seconds = parseInt(exercise.targetValue, 10);
          if (!Number.isFinite(seconds) || seconds < 1 || seconds > 3600) {
            return `Exercise ${i + 1}: target hold must be 1–3600 seconds.`;
          }
        }
        if (exercise.videoUrl.trim()) {
          try {
            // eslint-disable-next-line no-new
            new URL(exercise.videoUrl.trim());
          } catch {
            return `Exercise ${i + 1}: demo video URL must be valid.`;
          }
        }
      }
    }
    return null;
  };

  const handlePublish = async () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Check the form', validationError);
      return;
    }

    const payload: CreateWorkoutPayload = {
      title: form.title.trim(),
      description: form.description.trim(),
      distributionType:
        contentTab === 'tutoring' ? 'weekly_public' : form.distributionType,
      contentKind,
      videoUrl: form.videoUrl.trim() || undefined,
      duration: parseInt(form.duration, 10),
      difficulty: form.difficulty,
      workoutType: form.workoutType,
      targetMuscleGroups: resolveTargetMuscleGroups(form.muscleFocus),
      metaTags: {
        intensity: parseInt(form.intensity, 10) || 5,
        volumeLoadIndex: parseFloat(form.volumeLoadIndex) || 0.5,
        cardiovascularStress: parseInt(form.cardiovascularStress, 10) || 5,
        recoveryDemand: parseInt(form.recoveryDemand, 10) || 5,
        skillComplexity: parseInt(form.intensity, 10) || 5,
        mobilityDemand: 5,
      },
      exercises:
        contentTab === 'workouts'
          ? exercises.map((exercise) => {
              const base = {
                name: exercise.name.trim(),
                sets: parseInt(exercise.sets, 10),
                restTime: exercise.restTime.trim() || '60s',
                videoUrl: exercise.videoUrl.trim() || undefined,
                equipment: exercise.equipment,
              };
              if (exercise.targetType === 'duration') {
                return {
                  ...base,
                  reps: '1',
                  duration: parseInt(exercise.targetValue, 10) || 60,
                };
              }
              return {
                ...base,
                reps: exercise.targetValue.trim(),
              };
            })
          : undefined,
      assignedTo:
        contentTab === 'workouts' && form.distributionType === 'custom_client' && selectedClientId
          ? [selectedClientId]
          : undefined,
    };

    if (payload.targetMuscleGroups.length === 0) {
      payload.targetMuscleGroups = ['full_body'];
    }

    try {
      setPublishing(true);
      await api.post('/workouts', payload);
      Alert.alert(
        'Published',
        contentTab === 'tutoring'
          ? 'Tutoring video is live for Basic tier clients.'
          : 'Workout is live and visible to clients.'
      );
      setForm({ ...EMPTY_FORM, distributionType: form.distributionType });
      setExercises(createDefaultExerciseList());
      setSelectedClientId(null);
      await loadRecent();
    } catch (error) {
      Alert.alert('Publish failed', parseApiError(error, 'Could not publish content.'));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4af37" />
      }
    >
      <View style={styles.contentInner}>
      <View style={styles.segmentRow}>
        {(['workouts', 'tutoring', 'nutrition'] as ContentTab[]).map((tab) => {
          const active = contentTab === tab;
          const iconName: keyof typeof Ionicons.glyphMap =
            tab === 'workouts'
              ? 'barbell-outline'
              : tab === 'tutoring'
                ? 'videocam-outline'
                : 'nutrition-outline';
          const label =
            tab === 'workouts'
              ? 'Workouts'
              : tab === 'tutoring'
                ? 'Tutoring Videos'
                : 'Nutrition';
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.segmentButton, active && styles.segmentButtonActive]}
              onPress={() => setContentTab(tab)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={iconName}
                size={16}
                color={active ? '#1f2937' : '#6b7280'}
                style={styles.segmentIcon}
              />
              <Text
                style={[styles.segmentLabel, active && styles.segmentLabelActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {contentTab === 'nutrition' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Publish Nutrition Plan</Text>
          <Text style={styles.cardSubtitle}>
            General guides power the Basic-tier nutrition library. Custom macro plans deliver
            directly to a specific Active Client.
          </Text>

          <Field label="Title">
            <TextInput
              style={styles.input}
              value={nutritionForm.title}
              onChangeText={(title) => patchNutritionForm({ title })}
              placeholder="e.g. Lean Bulk – Week 3"
              placeholderTextColor="#9ca3af"
            />
          </Field>

          <Field label="Description">
            <TextInput
              style={[styles.input, styles.textArea]}
              value={nutritionForm.description}
              onChangeText={(description) => patchNutritionForm({ description })}
              placeholder="What the client should expect from this plan"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />
          </Field>

          <NutritionBuilder
            form={nutritionForm}
            onChange={patchNutritionForm}
            meals={meals}
            onMealsChange={setMeals}
            activeClients={activeClients}
            loadingClients={loadingClients}
            selectedClientId={selectedClientId}
            onClientSelect={setSelectedClientId}
          />

          <TouchableOpacity
            style={[styles.publishButton, publishing && styles.publishButtonDisabled]}
            onPress={handlePublishNutrition}
            disabled={publishing}
          >
            {publishing ? (
              <ActivityIndicator color="#1f2937" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#1f2937" />
                <Text style={styles.publishButtonText}>Publish Plan</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {contentTab === 'workouts' ? 'Publish Weekly Workout' : 'Publish Tutoring Video'}
        </Text>
        <Text style={styles.cardSubtitle}>
          {contentTab === 'workouts'
            ? 'Content appears in the client Workouts tab for Basic tier users.'
            : 'Instructional video linked for Basic tier tutoring library.'}
        </Text>

        {contentTab === 'workouts' && (
          <TouchableOpacity
            style={styles.manageWorkoutsLink}
            onPress={() => navigation.navigate('AdminWorkouts')}
          >
            <Ionicons name="list-outline" size={18} color="#92400e" />
            <Text style={styles.manageWorkoutsLinkText}>Manage Published Workouts</Text>
            <Ionicons name="chevron-forward" size={16} color="#92400e" />
          </TouchableOpacity>
        )}

        <Field label="Title">
          <TextInput
            style={styles.input}
            value={form.title}
            onChangeText={(title) => patchForm({ title })}
            placeholder="e.g. Full-Body Foundation"
            placeholderTextColor="#9ca3af"
          />
        </Field>

        <Field label="Description">
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.description}
            onChangeText={(description) => patchForm({ description })}
            placeholder="What clients should expect from this session"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
          />
        </Field>

        {contentTab === 'workouts' && (
          <Field label="Type">
            <View style={styles.chipRow}>
              {(
                [
                  { value: 'weekly_public' as DistributionType, label: 'Weekly Public' },
                  { value: 'custom_client' as DistributionType, label: 'Custom Client' },
                ] as const
              ).map((option) => {
                const active = form.distributionType === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => patchForm({ distributionType: option.value })}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>
        )}

        {contentTab === 'workouts' && form.distributionType === 'custom_client' && (
          <Field label="Assign To Client *">
            {loadingClients ? (
              <ActivityIndicator color="#d4af37" style={styles.clientLoader} />
            ) : activeClients.length === 0 ? (
              <Text style={styles.clientEmpty}>
                No Active Client tier users found. Promote a user or update their
                subscription tier first.
              </Text>
            ) : (
              <View style={styles.clientList}>
                {activeClients.map((client) => {
                  const active = selectedClientId === client._id;
                  const label = [client.firstName, client.lastName].filter(Boolean).join(' ').trim();
                  return (
                    <TouchableOpacity
                      key={client._id}
                      style={[styles.clientOption, active && styles.clientOptionActive]}
                      onPress={() => setSelectedClientId(client._id)}
                    >
                      <View style={styles.clientOptionBody}>
                        <Text style={[styles.clientOptionName, active && styles.clientOptionNameActive]}>
                          {label || client.email}
                        </Text>
                        <Text style={styles.clientOptionEmail}>{client.email}</Text>
                      </View>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={20} color="#d4af37" />
                      ) : (
                        <Ionicons name="ellipse-outline" size={20} color="#9ca3af" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Field>
        )}

        <Field label={contentTab === 'tutoring' ? 'Video URL *' : 'Video URL (optional)'}>
          <TextInput
            style={styles.input}
            value={form.videoUrl}
            onChangeText={(videoUrl) => patchForm({ videoUrl })}
            placeholder="https://..."
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="url"
          />
        </Field>

        <View style={styles.row}>
          <View style={styles.rowField}>
            <Field label="Duration (min)">
              <TextInput
                style={styles.input}
                value={form.duration}
                onChangeText={(duration) => patchForm({ duration })}
                keyboardType="number-pad"
                placeholder="30"
                placeholderTextColor="#9ca3af"
              />
            </Field>
          </View>
          <View style={styles.rowField}>
            <Field label="Difficulty">
              <View style={styles.chipRow}>
                {DIFFICULTY_OPTIONS.map((level) => {
                  const active = form.difficulty === level;
                  return (
                    <TouchableOpacity
                      key={level}
                      style={[styles.chipSmall, active && styles.chipActive]}
                      onPress={() => patchForm({ difficulty: level })}
                    >
                      <Text style={[styles.chipTextSmall, active && styles.chipTextActive]}>
                        {level.slice(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>
          </View>
        </View>

        {contentTab === 'workouts' && (
          <Field label="Workout style">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {WORKOUT_TYPE_OPTIONS.map((type) => {
                  const active = form.workoutType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => patchForm({ workoutType: type })}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </Field>
        )}

        <Field label="Muscle focus">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {MUSCLE_GROUP_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={styles.chip}
                  onPress={() => patchForm({ muscleFocus: preset.groups.join(', ') })}
                >
                  <Text style={styles.chipText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <TextInput
            style={[styles.input, styles.inputSpacingTop]}
            value={form.muscleFocus}
            onChangeText={(muscleFocus) => patchForm({ muscleFocus })}
            placeholder="full_body or chest, shoulders — upper_body expands automatically"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
          />
          <Text style={styles.fieldHint}>
            Valid: {MUSCLE_GROUP_OPTIONS.slice(0, 6).join(', ')}… Presets like upper_body map
            to chest, back, shoulders, etc.
          </Text>
        </Field>

        {contentTab === 'workouts' && (
          <ExerciseBuilder exercises={exercises} onChange={setExercises} />
        )}

        <Text style={styles.metaHeader}>ML Meta-Tags</Text>
        <View style={styles.row}>
          <View style={styles.rowField}>
            <Field label="Intensity (1–10)">
              <TextInput
                style={styles.input}
                value={form.intensity}
                onChangeText={(intensity) => patchForm({ intensity })}
                keyboardType="number-pad"
              />
            </Field>
          </View>
          <View style={styles.rowField}>
            <Field label="Volume load (0–1)">
              <TextInput
                style={styles.input}
                value={form.volumeLoadIndex}
                onChangeText={(volumeLoadIndex) => patchForm({ volumeLoadIndex })}
                keyboardType="decimal-pad"
              />
            </Field>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.rowField}>
            <Field label="Cardio stress (1–10)">
              <TextInput
                style={styles.input}
                value={form.cardiovascularStress}
                onChangeText={(cardiovascularStress) => patchForm({ cardiovascularStress })}
                keyboardType="number-pad"
              />
            </Field>
          </View>
          <View style={styles.rowField}>
            <Field label="Recovery demand (1–10)">
              <TextInput
                style={styles.input}
                value={form.recoveryDemand}
                onChangeText={(recoveryDemand) => patchForm({ recoveryDemand })}
                keyboardType="number-pad"
              />
            </Field>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.publishButton, publishing && styles.publishButtonDisabled]}
          onPress={handlePublish}
          disabled={publishing}
        >
          {publishing ? (
            <ActivityIndicator color="#1f2937" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color="#1f2937" />
              <Text style={styles.publishButtonText}>
                {contentTab === 'tutoring' ? 'Publish Video' : 'Publish Workout'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      )}

      <View style={styles.recentSection}>
        <Text style={styles.recentTitle}>Recently Published</Text>
        {loadingRecent ? (
          <ActivityIndicator color="#d4af37" style={styles.recentLoader} />
        ) : contentTab === 'nutrition' ? (
          recentNutrition.length === 0 ? (
            <Text style={styles.recentEmpty}>No nutrition plans published yet.</Text>
          ) : (
            recentNutrition.map((plan) => (
              <View key={plan._id} style={styles.recentRow}>
                <View style={styles.recentIconWrap}>
                  <Ionicons
                    name={plan.planType === 'macro_plan' ? 'restaurant' : 'document-text'}
                    size={16}
                    color="#d4af37"
                  />
                </View>
                <View style={styles.recentBody}>
                  <Text style={styles.recentItemTitle}>{plan.title}</Text>
                  <Text style={styles.recentItemMeta}>
                    {plan.planType === 'macro_plan'
                      ? `${plan.macros?.calories ?? 0} kcal · ${plan.meals?.length ?? 0} meals`
                      : 'General guide'}
                  </Text>
                  <Text style={styles.recentItemSubtitle}>
                    {plan.distributionType === 'weekly_public'
                      ? 'Weekly public · Basic tier'
                      : `Custom client${formatNutritionAssignees(plan)}`}
                  </Text>
                </View>
                {plan.fileUrl ? (
                  <Ionicons name="link-outline" size={16} color="#9ca3af" />
                ) : null}
              </View>
            ))
          )
        ) : recentItems.length === 0 ? (
          <Text style={styles.recentEmpty}>Nothing published yet in this category.</Text>
        ) : (
          recentItems.map((item) => {
            const assigneeNames = item.isCustom ? formatAssigneeNames(item) : null;
            const isWorkout = !item.tags?.includes('tutoring');
            return (
            <View key={item._id} style={styles.recentRow}>
              <View style={styles.recentIconWrap}>
                <Ionicons
                  name={item.tags?.includes('tutoring') ? 'videocam' : 'barbell'}
                  size={16}
                  color="#d4af37"
                />
              </View>
              <View style={styles.recentBody}>
                <Text style={styles.recentItemTitle}>{item.title}</Text>
                <Text style={styles.recentItemMeta}>{formatRecentStats(item)}</Text>
                <Text style={styles.recentItemSubtitle}>
                  {formatPublishedLabel(item)}
                  {assigneeNames ? ` · Assigned to ${assigneeNames}` : null}
                </Text>
              </View>
              {isWorkout ? (
                <TouchableOpacity
                  style={styles.recentEditButton}
                  onPress={() => navigation.navigate('AdminWorkoutForm', { workoutId: item._id })}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.title}`}
                >
                  <Ionicons name="pencil" size={16} color="#92400e" />
                </TouchableOpacity>
              ) : item.videoUrl ? (
                <Ionicons name="link-outline" size={16} color="#9ca3af" />
              ) : null}
            </View>
            );
          })
        )}
      </View>
      </View>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f7f7fb',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  contentInner: {
    width: '100%',
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    width: '100%',
  },
  segmentButton: {
    flex: 1,
    flexBasis: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    gap: 4,
    minHeight: 44,
  },
  segmentButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentIcon: {
    flexShrink: 0,
  },
  segmentLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
    flexShrink: 1,
  },
  segmentLabelActive: {
    color: '#1f2937',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  manageWorkoutsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  manageWorkoutsLinkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fafafa',
  },
  inputSpacingTop: {
    marginTop: 10,
  },
  fieldHint: {
    marginTop: 6,
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowField: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#d4af37',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
    textTransform: 'capitalize',
  },
  chipTextSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4b5563',
    textTransform: 'uppercase',
  },
  chipTextActive: {
    color: '#92400e',
  },
  metaHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
    marginTop: 4,
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4af37',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
    gap: 8,
  },
  publishButtonDisabled: {
    opacity: 0.7,
  },
  publishButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  recentSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  recentLoader: {
    paddingVertical: 16,
  },
  recentEmpty: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  recentIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recentBody: {
    flex: 1,
  },
  recentItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  recentItemMeta: {
    fontSize: 12,
    color: '#374151',
    marginTop: 2,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  recentItemSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  recentEditButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  clientLoader: {
    paddingVertical: 12,
  },
  clientEmpty: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  clientList: {
    gap: 8,
  },
  clientOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
  },
  clientOptionActive: {
    borderColor: '#d4af37',
    backgroundColor: '#fffbeb',
  },
  clientOptionBody: {
    flex: 1,
    marginRight: 8,
  },
  clientOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  clientOptionNameActive: {
    color: '#92400e',
  },
  clientOptionEmail: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
});
