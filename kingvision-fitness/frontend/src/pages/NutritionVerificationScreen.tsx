import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { verifyNutritionDay } from '../api/gamification';
import type { HomeStackParamList } from '../navigation/HomeNavigator';
import type { NutritionMacrosInput } from '../types/gamification';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'NutritionVerification'>;

function parseApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string } } }).response?.data;
    if (typeof data?.message === 'string' && data.message) return data.message;
  }
  return fallback;
}

function MacroField({
  label,
  value,
  onChangeText,
  unit,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  unit: string;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#bbb"
        />
        <Text style={styles.inputUnit}>{unit}</Text>
      </View>
    </View>
  );
}

/**
 * Daily macro verification form — feeds the nutrition pillar of the prestige
 * consistency engine (verified days / 7 rolling window).
 */
export default function NutritionVerificationScreen() {
  const navigation = useNavigation<Nav>();
  const [calories, setCalories] = useState('');
  const [carbs, setCarbs] = useState('');
  const [protein, setProtein] = useState('');
  const [fats, setFats] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const parseMacros = (): NutritionMacrosInput | null => {
    const parsed = {
      calories: Number(calories),
      carbs: Number(carbs),
      protein: Number(protein),
      fats: Number(fats),
    };

    const valid = Object.values(parsed).every(
      (value) => Number.isFinite(value) && value >= 0
    );
    return valid ? parsed : null;
  };

  const handleSubmit = async () => {
    const macrosLogged = parseMacros();
    if (!macrosLogged) {
      Alert.alert(
        'Missing macros',
        'Enter non-negative numbers for calories, carbs, protein, and fats.'
      );
      return;
    }

    try {
      setSubmitting(true);
      const result = await verifyNutritionDay({
        macrosLogged,
        imageUrl: imageUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      const score = Math.round(result.consistency.rollingConsistencyScore);
      Alert.alert(
        'Day verified',
        `Today's nutrition is logged. Your consistency score is now ${score}%.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Verification failed', parseApiError(error, 'Could not verify today.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <Ionicons name="nutrition-outline" size={28} color="#667eea" />
          <Text style={styles.heroTitle}>Verify Today's Nutrition</Text>
          <Text style={styles.heroBody}>
            Log macros, an optional meal photo URL, and notes. Seven verified days
            in a rolling week earns 100% on the nutrition pillar — five of seven
            days scores about 71%.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Macro Log</Text>
        <View style={styles.card}>
          <MacroField label="Calories" value={calories} onChangeText={setCalories} unit="kcal" />
          <MacroField label="Protein" value={protein} onChangeText={setProtein} unit="g" />
          <MacroField label="Carbs" value={carbs} onChangeText={setCarbs} unit="g" />
          <MacroField label="Fats" value={fats} onChangeText={setFats} unit="g" />
        </View>

        <Text style={styles.sectionTitle}>Meal Proof (Optional)</Text>
        <View style={styles.card}>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Meal Photo URL</Text>
            <TextInput
              style={styles.textArea}
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://…"
              placeholderTextColor="#bbb"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={[styles.textArea, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Where you ate, prep notes, how you felt…"
              placeholderTextColor="#bbb"
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Verify Today</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8e8f0',
    gap: 8,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#222',
  },
  heroBody: {
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f7fb',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    paddingVertical: 12,
  },
  inputUnit: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: '#f7f7fb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#222',
  },
  notesInput: {
    minHeight: 96,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#667eea',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
