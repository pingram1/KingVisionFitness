import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import api from '../services/api';
import type { AvailabilitySlot } from '../types/schedule';
import { DAY_LABELS } from '../types/schedule';
import type { HomeStackParamList } from '../navigation/HomeNavigator';
import RequireActiveClient from '../components/RequireActiveClient';
import {
  formatLongDate,
  formatTime12Hour,
  toHHMM,
  toYYYYMMDD,
} from '../utils/dateUtils';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'ClientBooking'>;

function parseApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string } } }).response?.data;
    if (typeof data?.message === 'string' && data.message) return data.message;
  }
  return fallback;
}

/**
 * ACTIVE_CLIENT booking flow — request a 1-on-1 session against the platform
 * trainer's weekly availability. All requests are created as `pending` for
 * admin review.
 *
 * Date/time entry uses the native pickers from
 * `@react-native-community/datetimepicker`. Values are stored as `Date`
 * objects in state and converted to the backend's "YYYY-MM-DD" / "HH:MM"
 * contract only at submit time.
 */
export default function ClientBookingScreen() {
  return (
    <RequireActiveClient featureLabel="1-on-1 session booking">
      <ClientBookingContent />
    </RequireActiveClient>
  );
}

function ClientBookingContent() {
  const navigation = useNavigation<Nav>();

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadSlots = useCallback(async () => {
    try {
      setSlotsError(null);
      const response = await api.get<{ success: boolean; data: AvailabilitySlot[] }>(
        '/schedule/available-slots'
      );
      setSlots(response.data.data ?? []);
    } catch (error) {
      console.error('Failed to load availability:', error);
      setSlotsError(parseApiError(error, 'Could not load trainer availability.'));
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const availableSlots = useMemo(() => slots.filter((s) => s.isAvailable), [slots]);

  // iOS keeps the spinner mounted ("spinner" / "compact") while Android opens
  // a modal that auto-dismisses on selection. We unify the close behaviour so
  // both platforms feel identical.
  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }
    if (event.type === 'dismissed') return;
    if (selected) setDate(selected);
  };

  const handleTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowTimePicker(false);
    }
    if (event.type === 'dismissed') return;
    if (selected) setTime(selected);
  };

  const validateForm = (): { error: string | null; payload?: { date: string; time: string } } => {
    if (!date) return { error: 'Pick a session date.' };
    if (!time) return { error: 'Pick a start time.' };

    const dateStr = toYYYYMMDD(date);
    const timeStr = toHHMM(time);
    const selected = new Date(`${dateStr}T${timeStr}:00`);

    if (Number.isNaN(selected.getTime())) {
      return { error: 'Invalid date/time combination.' };
    }
    if (selected.getTime() < Date.now()) {
      return { error: 'Please choose a future date and time.' };
    }

    const daySlot = availableSlots.find((s) => s.dayOfWeek === selected.getDay());
    if (!daySlot) {
      return {
        error: `KingVision is not available on ${DAY_LABELS[selected.getDay()]}. Pick another day.`,
      };
    }

    const endMinutes = selected.getHours() * 60 + selected.getMinutes() + 60;
    const endHHMM = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(
      endMinutes % 60
    ).padStart(2, '0')}`;
    if (timeStr < daySlot.startTime || endHHMM > daySlot.endTime) {
      return {
        error: `Choose a time between ${formatTime12Hour(daySlot.startTime)} and ${formatTime12Hour(daySlot.endTime)} on ${DAY_LABELS[selected.getDay()]}.`,
      };
    }

    return { error: null, payload: { date: dateStr, time: timeStr } };
  };

  const handleSubmit = async () => {
    const { error, payload } = validateForm();
    if (error || !payload) {
      Alert.alert('Check the form', error ?? 'Invalid form.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/schedule/book', {
        date: payload.date,
        time: payload.time,
        notes: notes.trim() || undefined,
      });

      Alert.alert(
        'Session Requested!',
        'KingVision will review and confirm your time.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Request failed', parseApiError(error, 'Could not submit session request.'));
    } finally {
      setSubmitting(false);
    }
  };

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heroCard}>
        <Ionicons name="calendar" size={28} color="#667eea" />
        <Text style={styles.heroTitle}>Book a 1-on-1 Session</Text>
        <Text style={styles.heroSubtitle}>
          Pick a time within KingVision&apos;s available hours. Your request will be
          reviewed before confirmation.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Trainer Availability</Text>
        {loadingSlots ? (
          <ActivityIndicator color="#667eea" style={styles.loader} />
        ) : slotsError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{slotsError}</Text>
            <TouchableOpacity onPress={loadSlots}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        ) : availableSlots.length === 0 ? (
          <Text style={styles.emptyText}>
            No availability published yet. Check back soon.
          </Text>
        ) : (
          availableSlots.map((slot) => (
            <View key={slot.dayOfWeek} style={styles.availabilityRow}>
              <Text style={styles.dayLabel}>{DAY_LABELS[slot.dayOfWeek]}</Text>
              <Text style={styles.hoursLabel}>
                {formatTime12Hour(slot.startTime)} – {formatTime12Hour(slot.endTime)}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Request a Time</Text>

        <Field label="Date">
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowDatePicker(true)}
            accessibilityRole="button"
          >
            <Ionicons name="calendar-outline" size={18} color="#667eea" />
            <Text style={[styles.pickerButtonText, !date && styles.pickerButtonPlaceholder]}>
              {date ? formatLongDate(date) : 'Select a date'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date ?? today}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={today}
              onChange={handleDateChange}
            />
          )}
        </Field>

        <Field label="Start Time">
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowTimePicker(true)}
            accessibilityRole="button"
          >
            <Ionicons name="time-outline" size={18} color="#667eea" />
            <Text style={[styles.pickerButtonText, !time && styles.pickerButtonPlaceholder]}>
              {time ? formatTime12Hour(toHHMM(time)) : 'Select a start time'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={time ?? new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              is24Hour={false}
              minuteInterval={15}
              onChange={handleTimeChange}
            />
          )}
        </Field>

        <Field label="Notes (optional)">
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Want to focus on mobility"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
          />
        </Field>

        <Text style={styles.hint}>Sessions default to 60 minutes.</Text>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting || loadingSlots}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send-outline" size={18} color="#fff" />
              <Text style={styles.submitButtonText}>Request Session</Text>
            </>
          )}
        </TouchableOpacity>
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
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 10,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 6,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  loader: {
    paddingVertical: 16,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
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
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  availabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  hoursLabel: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
  },
  pickerButtonText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  pickerButtonPlaceholder: {
    color: '#9ca3af',
    fontWeight: '400',
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 12,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
