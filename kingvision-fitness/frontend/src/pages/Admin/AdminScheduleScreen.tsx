import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import api from '../../services/api';
import type { AvailabilitySlot, Booking, BookingStatus, ScheduleUserSummary } from '../../types/schedule';
import { DAY_LABELS } from '../../types/schedule';
import { formatTime12Hour, toHHMM } from '../../utils/dateUtils';

type TimeField = 'startTime' | 'endTime';

function hhmmToDate(value: string): Date {
  const [h, m] = value.split(':').map((n) => Number.parseInt(n, 10));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

type ScheduleTab = 'sessions' | 'availability';

function parseApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string } } }).response?.data;
    if (typeof data?.message === 'string' && data.message) return data.message;
  }
  return fallback;
}

function clientDisplayName(client: ScheduleUserSummary | string): string {
  if (typeof client === 'string') return 'Client';
  const full = [client.profile?.firstName, client.profile?.lastName].filter(Boolean).join(' ').trim();
  return full || client.email || 'Client';
}

function formatSessionRange(startTime: string, endTime: string): string {
  try {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    return `${format(start, 'EEE, MMM d · h:mm a')} – ${format(end, 'h:mm a')}`;
  } catch {
    return `${formatTime12Hour(startTime)} – ${formatTime12Hour(endTime)}`;
  }
}

function statusStyle(status: BookingStatus) {
  switch (status) {
    case 'pending':
      return { bg: '#fef3c7', text: '#92400e', label: 'Pending' };
    case 'confirmed':
      return { bg: '#dcfce7', text: '#166534', label: 'Confirmed' };
    case 'cancelled':
      return { bg: '#fee2e2', text: '#991b1b', label: 'Cancelled' };
    case 'completed':
      return { bg: '#e0e7ff', text: '#3730a3', label: 'Completed' };
    default:
      return { bg: '#f3f4f6', text: '#374151', label: status };
  }
}

function defaultAvailabilitySlots(): AvailabilitySlot[] {
  return DAY_LABELS.map((_, dayOfWeek) => ({
    dayOfWeek,
    startTime: '09:00',
    endTime: '17:00',
    isAvailable: dayOfWeek >= 1 && dayOfWeek <= 5,
  }));
}

/**
 * Admin scheduling console — manage 1-on-1 session requests and weekly
 * availability for ACTIVE_CLIENT bookings.
 */
export default function AdminScheduleScreen() {
  const [activeTab, setActiveTab] = useState<ScheduleTab>('sessions');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);

  const [availability, setAvailability] = useState<AvailabilitySlot[]>(defaultAvailabilitySlots);
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  /**
   * Tracks which day+field is currently editing time via the native picker.
   * iOS keeps the picker mounted inline; Android shows a modal. Setting back
   * to `null` closes the inline iOS picker. One picker open at a time.
   */
  const [editingTime, setEditingTime] = useState<{
    dayOfWeek: number;
    field: TimeField;
  } | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const loadBookings = useCallback(async () => {
    try {
      setBookingsError(null);
      const response = await api.get<{ success: boolean; data: Booking[] }>(
        '/schedule/admin/bookings'
      );
      setBookings(response.data.data ?? []);
    } catch (error) {
      console.error('Failed to load bookings:', error);
      setBookingsError(parseApiError(error, 'Could not load session requests.'));
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  const loadAvailability = useCallback(async () => {
    try {
      setAvailabilityError(null);
      const response = await api.get<{ success: boolean; data: AvailabilitySlot[] }>(
        '/schedule/admin/availability'
      );
      const slots = response.data.data ?? [];
      setAvailability(slots.length > 0 ? slots : defaultAvailabilitySlots());
    } catch (error) {
      console.error('Failed to load availability:', error);
      setAvailabilityError(parseApiError(error, 'Could not load availability.'));
    } finally {
      setLoadingAvailability(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
    loadAvailability();
  }, [loadBookings, loadAvailability]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadBookings(), loadAvailability()]);
    setRefreshing(false);
  }, [loadBookings, loadAvailability]);

  const updateBookingStatus = async (bookingId: string, status: BookingStatus) => {
    try {
      setUpdatingBookingId(bookingId);
      await api.patch(`/schedule/admin/bookings/${bookingId}`, { status });
      await loadBookings();
    } catch (error) {
      Alert.alert('Update failed', parseApiError(error, 'Could not update booking.'));
    } finally {
      setUpdatingBookingId(null);
    }
  };

  const confirmBooking = (booking: Booking) => {
    Alert.alert('Confirm session', `Confirm session with ${clientDisplayName(booking.clientId)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () => updateBookingStatus(booking._id, 'confirmed'),
      },
    ]);
  };

  const cancelBooking = (booking: Booking) => {
    Alert.alert('Cancel session', `Cancel session with ${clientDisplayName(booking.clientId)}?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel session',
        style: 'destructive',
        onPress: () => updateBookingStatus(booking._id, 'cancelled'),
      },
    ]);
  };

  const patchAvailabilityDay = (dayOfWeek: number, patch: Partial<AvailabilitySlot>) => {
    setAvailability((prev) =>
      prev.map((slot) => (slot.dayOfWeek === dayOfWeek ? { ...slot, ...patch } : slot))
    );
  };

  const onTimePickerChange = (
    dayOfWeek: number,
    field: TimeField,
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (Platform.OS !== 'ios') {
      setEditingTime(null);
    }
    if (event.type === 'dismissed' || !selected) return;
    patchAvailabilityDay(dayOfWeek, { [field]: toHHMM(selected) } as Partial<AvailabilitySlot>);
  };

  const saveAvailability = async () => {
    for (const slot of availability) {
      if (slot.isAvailable && slot.startTime >= slot.endTime) {
        Alert.alert(
          'Check times',
          `${DAY_LABELS[slot.dayOfWeek]}: end time must be after start time.`
        );
        return;
      }
    }

    try {
      setSavingAvailability(true);
      setAvailabilityError(null);
      await api.put('/schedule/admin/availability', { schedule: availability });
      Alert.alert('Saved', 'Weekly availability updated.');
      await loadAvailability();
    } catch (error) {
      Alert.alert('Save failed', parseApiError(error, 'Could not save availability.'));
    } finally {
      setSavingAvailability(false);
    }
  };

  const upcomingBookings = [...bookings].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4af37" />
      }
    >
      <View style={styles.segmentRow}>
        {(
          [
            { id: 'sessions' as ScheduleTab, label: 'Upcoming Sessions', icon: 'calendar-outline' },
            { id: 'availability' as ScheduleTab, label: 'Availability Settings', icon: 'time-outline' },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.segmentButton, active && styles.segmentButtonActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons name={tab.icon} size={15} color={active ? '#1f2937' : '#6b7280'} />
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'sessions' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Session Requests</Text>
          <Text style={styles.cardSubtitle}>
            Review and confirm 1-on-1 requests from Active Client members.
          </Text>

          {loadingBookings ? (
            <ActivityIndicator color="#d4af37" style={styles.loader} />
          ) : bookingsError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{bookingsError}</Text>
              <TouchableOpacity onPress={loadBookings}>
                <Text style={styles.retryText}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : upcomingBookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={28} color="#9ca3af" />
              <Text style={styles.emptyTitle}>No sessions yet</Text>
              <Text style={styles.emptyBody}>
                When Active Client users request a session, they will appear here for
                confirmation.
              </Text>
            </View>
          ) : (
            upcomingBookings.map((booking) => {
              const badge = statusStyle(booking.status);
              const isUpdating = updatingBookingId === booking._id;
              return (
                <View key={booking._id} style={styles.bookingRow}>
                  <View style={styles.bookingHeader}>
                    <View style={styles.bookingTitleBlock}>
                      <Text style={styles.bookingClient}>
                        {clientDisplayName(booking.clientId)}
                      </Text>
                      <Text style={styles.bookingTime}>
                        {formatSessionRange(booking.startTime, booking.endTime)}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  {booking.notes ? (
                    <Text style={styles.bookingNotes}>{booking.notes}</Text>
                  ) : null}

                  {booking.status === 'pending' && (
                    <View style={styles.bookingActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.confirmButton]}
                        onPress={() => confirmBooking(booking)}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <ActivityIndicator size="small" color="#166534" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle-outline" size={16} color="#166534" />
                            <Text style={styles.confirmButtonText}>Confirm</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.cancelButton]}
                        onPress={() => cancelBooking(booking)}
                        disabled={isUpdating}
                      >
                        <Ionicons name="close-circle-outline" size={16} color="#991b1b" />
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Availability</Text>
          <Text style={styles.cardSubtitle}>
            Set the days and hours you accept 1-on-1 session requests.
          </Text>

          {loadingAvailability ? (
            <ActivityIndicator color="#d4af37" style={styles.loader} />
          ) : availabilityError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{availabilityError}</Text>
              <TouchableOpacity onPress={loadAvailability}>
                <Text style={styles.retryText}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {[...availability]
                .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                .map((slot) => (
                  <View
                    key={slot.dayOfWeek}
                    style={[styles.dayRow, slot.isAvailable && styles.dayRowActive]}
                  >
                    <View style={styles.dayHeader}>
                      <Text style={styles.dayLabel}>{DAY_LABELS[slot.dayOfWeek]}</Text>
                      <Switch
                        value={slot.isAvailable}
                        onValueChange={(isAvailable) =>
                          patchAvailabilityDay(slot.dayOfWeek, { isAvailable })
                        }
                        trackColor={{ false: '#e5e7eb', true: '#fde68a' }}
                        thumbColor={slot.isAvailable ? '#d4af37' : '#f3f4f6'}
                      />
                    </View>

                    {slot.isAvailable && (
                      <>
                        <View style={styles.timeControlsRow}>
                          <View style={styles.timeField}>
                            <Text style={styles.timeLabel}>Start</Text>
                            <TouchableOpacity
                              style={[
                                styles.timePickerButton,
                                editingTime?.dayOfWeek === slot.dayOfWeek &&
                                  editingTime.field === 'startTime' &&
                                  styles.timePickerButtonActive,
                              ]}
                              onPress={() =>
                                setEditingTime(
                                  editingTime?.dayOfWeek === slot.dayOfWeek &&
                                    editingTime.field === 'startTime'
                                    ? null
                                    : { dayOfWeek: slot.dayOfWeek, field: 'startTime' }
                                )
                              }
                            >
                              <Ionicons name="time-outline" size={16} color="#d4af37" />
                              <Text style={styles.timePickerText} numberOfLines={1}>
                                {formatTime12Hour(slot.startTime)}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          <View style={styles.timeFieldDivider}>
                            <Text style={styles.timeFieldDividerText}>to</Text>
                          </View>

                          <View style={styles.timeField}>
                            <Text style={styles.timeLabel}>End</Text>
                            <TouchableOpacity
                              style={[
                                styles.timePickerButton,
                                editingTime?.dayOfWeek === slot.dayOfWeek &&
                                  editingTime.field === 'endTime' &&
                                  styles.timePickerButtonActive,
                              ]}
                              onPress={() =>
                                setEditingTime(
                                  editingTime?.dayOfWeek === slot.dayOfWeek &&
                                    editingTime.field === 'endTime'
                                    ? null
                                    : { dayOfWeek: slot.dayOfWeek, field: 'endTime' }
                                )
                              }
                            >
                              <Ionicons name="time-outline" size={16} color="#d4af37" />
                              <Text style={styles.timePickerText} numberOfLines={1}>
                                {formatTime12Hour(slot.endTime)}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {editingTime?.dayOfWeek === slot.dayOfWeek && (
                          <View style={styles.pickerPanel}>
                            <View style={styles.pickerPanelHeader}>
                              <Text style={styles.pickerPanelTitle}>
                                {editingTime.field === 'startTime' ? 'Start time' : 'End time'} —{' '}
                                {DAY_LABELS[slot.dayOfWeek]}
                              </Text>
                              {Platform.OS === 'ios' && (
                                <TouchableOpacity
                                  onPress={() => setEditingTime(null)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Text style={styles.pickerDoneText}>Done</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                            <DateTimePicker
                              value={hhmmToDate(slot[editingTime.field])}
                              mode="time"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              is24Hour={false}
                              minuteInterval={15}
                              style={styles.pickerWheel}
                              onChange={(event, selected) =>
                                onTimePickerChange(
                                  slot.dayOfWeek,
                                  editingTime.field,
                                  event,
                                  selected
                                )
                              }
                            />
                          </View>
                        )}
                      </>
                    )}
                  </View>
                ))}

              <TouchableOpacity
                style={[styles.saveButton, savingAvailability && styles.saveButtonDisabled]}
                onPress={saveAvailability}
                disabled={savingAvailability}
              >
                {savingAvailability ? (
                  <ActivityIndicator color="#1f2937" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#1f2937" />
                    <Text style={styles.saveButtonText}>Save Availability</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </ScrollView>
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
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 5,
  },
  segmentButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  segmentLabelActive: {
    color: '#1f2937',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
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
  loader: {
    paddingVertical: 24,
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
    color: '#b45309',
    fontWeight: '600',
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginTop: 10,
  },
  emptyBody: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  bookingRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    paddingTop: 14,
    paddingBottom: 4,
    marginTop: 4,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  bookingTitleBlock: {
    flex: 1,
  },
  bookingClient: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  bookingTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bookingNotes: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 8,
    fontStyle: 'italic',
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  confirmButton: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  confirmButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  cancelButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991b1b',
  },
  dayRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  dayRowActive: {
    backgroundColor: '#fffdf5',
    borderRadius: 12,
    marginTop: 4,
    paddingHorizontal: 12,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: '#fde68a40',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  timeControlsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  timeField: {
    flex: 1,
    minWidth: 0,
  },
  timeFieldDivider: {
    paddingBottom: 12,
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  timeFieldDividerText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  timePickerButtonActive: {
    borderColor: '#d4af37',
    backgroundColor: '#fffbeb',
    shadowColor: '#d4af37',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  timePickerText: {
    flexShrink: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  pickerPanel: {
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    overflow: 'hidden',
  },
  pickerPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fffbeb',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#fde68a',
  },
  pickerPanelTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400e',
  },
  pickerDoneText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#d4af37',
  },
  pickerWheel: {
    width: '100%',
    height: Platform.OS === 'ios' ? 180 : undefined,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4af37',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
});
