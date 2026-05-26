import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import api from '../services/api';
import type { Booking, BookingStatus, ScheduleUserSummary } from '../types/schedule';
import type { HomeStackParamList } from '../navigation/HomeNavigator';
import { formatDateTime12Hour } from '../utils/dateUtils';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'ClientSessions'>;

type SessionsTab = 'upcoming' | 'past';

function parseApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string } } }).response?.data;
    if (typeof data?.message === 'string' && data.message) return data.message;
  }
  return fallback;
}

function trainerDisplayName(trainer: ScheduleUserSummary | string): string {
  if (typeof trainer === 'string') return 'Your Trainer';
  const full = [trainer.profile?.firstName, trainer.profile?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return full || trainer.email || 'Your Trainer';
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

function formatSessionDateTime(startTime: string, endTime: string): { date: string; time: string } {
  try {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    return {
      date: format(start, 'EEE, MMM d, yyyy'),
      time: `${formatDateTime12Hour(start)} – ${formatDateTime12Hour(end)}`,
    };
  } catch {
    return {
      date: startTime,
      time: `${formatDateTime12Hour(startTime)} – ${formatDateTime12Hour(endTime)}`,
    };
  }
}

/**
 * ACTIVE_CLIENT dashboard — view pending/confirmed upcoming sessions and
 * completed/cancelled history. Clients can cancel their own upcoming bookings.
 */
export default function ClientSessionsScreen() {
  const navigation = useNavigation<Nav>();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SessionsTab>('upcoming');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    try {
      setLoadError(null);
      const response = await api.get<{ success: boolean; data: Booking[] }>(
        '/schedule/my-bookings'
      );
      setBookings(response.data.data ?? []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setLoadError(parseApiError(error, 'Could not load your sessions.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  }, [loadBookings]);

  const { upcoming, past } = useMemo(() => {
    const up: Booking[] = [];
    const pa: Booking[] = [];
    for (const booking of bookings) {
      if (booking.status === 'pending' || booking.status === 'confirmed') {
        up.push(booking);
      } else {
        pa.push(booking);
      }
    }
    return { upcoming: up, past: [...pa].reverse() };
  }, [bookings]);

  const visibleBookings = activeTab === 'upcoming' ? upcoming : past;

  const confirmCancel = (booking: Booking) => {
    const { date, time } = formatSessionDateTime(booking.startTime, booking.endTime);
    Alert.alert(
      'Cancel session?',
      `Cancel your session on ${date} at ${time}?`,
      [
        { text: 'Keep Session', style: 'cancel' },
        {
          text: 'Cancel Session',
          style: 'destructive',
          onPress: () => handleCancel(booking._id),
        },
      ]
    );
  };

  const handleCancel = async (bookingId: string) => {
    try {
      setCancellingId(bookingId);
      await api.patch(`/schedule/my-bookings/${bookingId}/cancel`);
      await loadBookings();
      Alert.alert('Session cancelled', 'Your session request has been cancelled.');
    } catch (error) {
      Alert.alert('Cancel failed', parseApiError(error, 'Could not cancel this session.'));
    } finally {
      setCancellingId(null);
    }
  };

  if (loading && bookings.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading your sessions…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.heroCard}>
        <Ionicons name="calendar-outline" size={28} color="#667eea" />
        <Text style={styles.heroTitle}>My Sessions</Text>
        <Text style={styles.heroSubtitle}>
          Track pending requests, confirmed appointments, and session history.
        </Text>
      </View>

      <View style={styles.segmentRow}>
        {(
          [
            { id: 'upcoming' as SessionsTab, label: 'Upcoming', count: upcoming.length },
            { id: 'past' as SessionsTab, label: 'Past History', count: past.length },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.segmentButton, active && styles.segmentButtonActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                {tab.label}
              </Text>
              <View style={[styles.countBadge, active && styles.countBadgeActive]}>
                <Text style={[styles.countText, active && styles.countTextActive]}>
                  {tab.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity onPress={loadBookings}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : visibleBookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name={activeTab === 'upcoming' ? 'calendar-outline' : 'time-outline'}
            size={36}
            color="#9ca3af"
          />
          <Text style={styles.emptyTitle}>
            {activeTab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions'}
          </Text>
          <Text style={styles.emptyBody}>
            {activeTab === 'upcoming'
              ? 'Book a 1-on-1 session from the Home tab to get started.'
              : 'Completed and cancelled sessions will appear here.'}
          </Text>
          {activeTab === 'upcoming' && (
            <TouchableOpacity
              style={styles.bookButton}
              onPress={() => navigation.navigate('ClientBooking')}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.bookButtonText}>Book a Session</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        visibleBookings.map((booking) => {
          const badge = statusStyle(booking.status);
          const { date, time } = formatSessionDateTime(booking.startTime, booking.endTime);
          const isCancelling = cancellingId === booking._id;
          const canCancel =
            activeTab === 'upcoming' &&
            (booking.status === 'pending' || booking.status === 'confirmed');

          return (
            <View key={booking._id} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <View style={styles.sessionTitleBlock}>
                  <Text style={styles.trainerName}>
                    with {trainerDisplayName(booking.trainerId)}
                  </Text>
                  <Text style={styles.sessionDate}>{date}</Text>
                  <Text style={styles.sessionTime}>{time}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                    {badge.label}
                  </Text>
                </View>
              </View>

              {booking.notes ? (
                <Text style={styles.sessionNotes}>{booking.notes}</Text>
              ) : null}

              {canCancel && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => confirmCancel(booking)}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <ActivityIndicator size="small" color="#991b1b" />
                  ) : (
                    <>
                      <Ionicons name="close-circle-outline" size={16} color="#991b1b" />
                      <Text style={styles.cancelButtonText}>Cancel Session</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f7fb',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  heroCard: {
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
    gap: 6,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  segmentLabelActive: {
    color: '#111827',
  },
  countBadge: {
    backgroundColor: '#d1d5db',
    borderRadius: 999,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeActive: {
    backgroundColor: '#667eea',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  countTextActive: {
    color: '#ffffff',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
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
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
  },
  emptyBody: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#667eea',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 16,
  },
  bookButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  sessionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  sessionTitleBlock: {
    flex: 1,
  },
  trainerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  sessionDate: {
    fontSize: 14,
    color: '#374151',
    marginTop: 6,
    fontWeight: '600',
  },
  sessionTime: {
    fontSize: 13,
    color: '#667eea',
    marginTop: 4,
    fontWeight: '600',
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
  sessionNotes: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 10,
    fontStyle: 'italic',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991b1b',
  },
});
