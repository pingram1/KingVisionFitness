import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ActiveClientSummary } from '../../types/user';
import type {
  NutritionDistributionType,
  NutritionPlanType,
} from '../../types/nutrition';

export interface MealDraft {
  id: string;
  name: string;
  time: string;
  foodItems: string;
}

export interface NutritionFormState {
  title: string;
  description: string;
  distributionType: NutritionDistributionType;
  planType: NutritionPlanType;
  fileUrl: string;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
}

export function createEmptyMeal(): MealDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    time: '',
    foodItems: '',
  };
}

export function createDefaultMealList(): MealDraft[] {
  return [
    { ...createEmptyMeal(), name: 'Breakfast', time: '8:00 AM' },
    { ...createEmptyMeal(), name: 'Lunch', time: '12:30 PM' },
    { ...createEmptyMeal(), name: 'Dinner', time: '7:00 PM' },
  ];
}

export const EMPTY_NUTRITION_FORM: NutritionFormState = {
  title: '',
  description: '',
  distributionType: 'weekly_public',
  planType: 'general_guide',
  fileUrl: '',
  calories: '2200',
  protein: '180',
  carbs: '220',
  fats: '70',
};

interface Props {
  form: NutritionFormState;
  onChange: (patch: Partial<NutritionFormState>) => void;
  meals: MealDraft[];
  onMealsChange: (meals: MealDraft[]) => void;
  activeClients: ActiveClientSummary[];
  loadingClients: boolean;
  selectedClientId: string | null;
  onClientSelect: (id: string) => void;
}

/**
 * Nutrition Builder — drives the Admin Content Studio "Nutrition" tab.
 * Renders distribution + plan-type toggles, optional macro/meal authoring,
 * and the Active Client picker reused from the workout custom flow.
 */
export default function NutritionBuilder({
  form,
  onChange,
  meals,
  onMealsChange,
  activeClients,
  loadingClients,
  selectedClientId,
  onClientSelect,
}: Props) {
  const isCustom = form.distributionType === 'custom_client';
  const isMacroPlan = form.planType === 'macro_plan';

  const patchMeal = (id: string, patch: Partial<MealDraft>) => {
    onMealsChange(meals.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const addMeal = () => {
    onMealsChange([...meals, createEmptyMeal()]);
  };

  const removeMeal = (id: string) => {
    if (meals.length <= 1) return;
    onMealsChange(meals.filter((m) => m.id !== id));
  };

  return (
    <View>
      <Field label="Distribution">
        <View style={styles.chipRow}>
          {(
            [
              { value: 'weekly_public', label: 'General Guide' },
              { value: 'custom_client', label: 'Custom Macro Plan' },
            ] as const
          ).map((option) => {
            const active = form.distributionType === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  const nextPlan: NutritionPlanType =
                    option.value === 'custom_client' ? 'macro_plan' : 'general_guide';
                  onChange({
                    distributionType: option.value,
                    planType: nextPlan,
                  });
                }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.fieldHint}>
          {isCustom
            ? 'Locked to the assigned Active Client. Macros & meals required.'
            : 'Shown in the Basic-tier Nutrition library.'}
        </Text>
      </Field>

      <Field label="Plan type">
        <View style={styles.chipRow}>
          {(
            [
              { value: 'general_guide', label: 'General Guide' },
              { value: 'macro_plan', label: 'Macro Plan' },
            ] as const
          ).map((option) => {
            const active = form.planType === option.value;
            const disabled = isCustom && option.value === 'general_guide';
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.chip,
                  active && styles.chipActive,
                  disabled && styles.chipDisabled,
                ]}
                onPress={() => !disabled && onChange({ planType: option.value })}
                disabled={disabled}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Field>

      {isCustom && (
        <Field label="Assign To Client *">
          {loadingClients ? (
            <Text style={styles.helperText}>Loading clients…</Text>
          ) : activeClients.length === 0 ? (
            <Text style={styles.helperText}>
              No Active Client tier users found. Promote a user first.
            </Text>
          ) : (
            <View style={styles.clientList}>
              {activeClients.map((client) => {
                const active = selectedClientId === client._id;
                const label = [client.firstName, client.lastName]
                  .filter(Boolean)
                  .join(' ')
                  .trim();
                return (
                  <TouchableOpacity
                    key={client._id}
                    style={[styles.clientOption, active && styles.clientOptionActive]}
                    onPress={() => onClientSelect(client._id)}
                  >
                    <View style={styles.clientOptionBody}>
                      <Text
                        style={[
                          styles.clientOptionName,
                          active && styles.clientOptionNameActive,
                        ]}
                      >
                        {label || client.email}
                      </Text>
                      <Text style={styles.clientOptionEmail}>{client.email}</Text>
                    </View>
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={active ? '#d4af37' : '#9ca3af'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Field>
      )}

      {form.planType === 'general_guide' && (
        <Field label="Attachment URL (PDF / image, optional)">
          <TextInput
            style={styles.input}
            value={form.fileUrl}
            onChangeText={(fileUrl) => onChange({ fileUrl })}
            placeholder="https://..."
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="url"
          />
        </Field>
      )}

      {isMacroPlan && (
        <>
          <Text style={styles.sectionHeader}>Daily Macros *</Text>
          <View style={styles.macroGrid}>
            <MacroInput
              label="Calories"
              value={form.calories}
              onChange={(calories) => onChange({ calories })}
            />
            <MacroInput
              label="Protein (g)"
              value={form.protein}
              onChange={(protein) => onChange({ protein })}
            />
            <MacroInput
              label="Carbs (g)"
              value={form.carbs}
              onChange={(carbs) => onChange({ carbs })}
            />
            <MacroInput
              label="Fats (g)"
              value={form.fats}
              onChange={(fats) => onChange({ fats })}
            />
          </View>

          <View style={styles.headerRow}>
            <Text style={styles.sectionHeader}>Meals *</Text>
            <TouchableOpacity style={styles.addButton} onPress={addMeal}>
              <Ionicons name="add-circle-outline" size={18} color="#92400e" />
              <Text style={styles.addButtonText}>Add Meal</Text>
            </TouchableOpacity>
          </View>

          {meals.map((meal, index) => (
            <View key={meal.id} style={styles.mealCard}>
              <View style={styles.mealCardHeader}>
                <Text style={styles.mealIndex}>Meal {index + 1}</Text>
                {meals.length > 1 && (
                  <TouchableOpacity onPress={() => removeMeal(meal.id)}>
                    <Ionicons name="trash-outline" size={18} color="#991b1b" />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mealRow}
              >
                <View style={styles.mealFieldSmall}>
                  <Text style={styles.miniLabel}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={meal.name}
                    onChangeText={(name) => patchMeal(meal.id, { name })}
                    placeholder="Breakfast"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
                <View style={styles.mealFieldSmall}>
                  <Text style={styles.miniLabel}>Time</Text>
                  <TextInput
                    style={styles.input}
                    value={meal.time}
                    onChangeText={(time) => patchMeal(meal.id, { time })}
                    placeholder="8:00 AM"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </ScrollView>
              <View style={styles.mealFieldWide}>
                <Text style={styles.miniLabel}>Food items (comma-separated)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={meal.foodItems}
                  onChangeText={(foodItems) => patchMeal(meal.id, { foodItems })}
                  placeholder="3 eggs, 1 cup oats, 1 banana"
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={2}
                />
              </View>
            </View>
          ))}
        </>
      )}
    </View>
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

function MacroInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <View style={styles.macroField}>
      <Text style={styles.miniLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        placeholderTextColor="#9ca3af"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    lineHeight: 17,
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
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
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
  chipActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#d4af37',
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  chipTextActive: {
    color: '#92400e',
  },
  helperText: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  clientList: { gap: 8 },
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
  clientOptionBody: { flex: 1, marginRight: 8 },
  clientOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  clientOptionNameActive: { color: '#92400e' },
  clientOptionEmail: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 6,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  macroField: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  miniLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 6,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
  },
  mealCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fdfdfd',
  },
  mealCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mealIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  mealRow: {
    gap: 8,
    paddingBottom: 6,
  },
  mealFieldSmall: {
    width: 160,
    marginRight: 8,
  },
  mealFieldWide: {
    marginTop: 8,
  },
});
