import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { fetchPublishedWorkouts } from '../../api/workoutAdmin';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import type { AdminContentStackParamList } from '../../navigation/AdminContentNavigator';
import type { Workout } from '../../types/workout';

type Nav = NativeStackNavigationProp<AdminContentStackParamList, 'AdminWorkouts'>;

function formatWorkoutLabel(item: Workout): string {
  if (item.isCustom) return 'Custom client workout';
  if (item.isPublic) return `Weekly public · Week ${item.weekNumber ?? '?'}`;
  return 'Published workout';
}

function formatWorkoutMeta(item: Workout): string {
  const exerciseCount = item.exercises?.length ?? 0;
  const parts = [
    exerciseCount > 0 ? `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}` : null,
    `${item.duration} min`,
    item.difficulty,
  ].filter(Boolean);
  return parts.join(' · ');
}

export default function AdminWorkoutsScreen() {
  const navigation = useNavigation<Nav>();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkouts = useCallback(async (showFullScreenLoader = true) => {
    try {
      setError(null);
      if (showFullScreenLoader) setLoading(true);
      const data = await fetchPublishedWorkouts(50);
      setWorkouts(data.filter((item) => !item.tags?.includes('tutoring')));
    } catch (err) {
      console.error('Failed to load published workouts:', err);
      setError('Could not load published workouts.');
      setWorkouts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh(loadWorkouts, 0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWorkouts(false);
    setRefreshing(false);
  }, [loadWorkouts]);

  const openEditor = (workoutId: string) => {
    navigation.navigate('AdminWorkoutForm', { workoutId });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#d4af37" size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={workouts}
      keyExtractor={(item) => item._id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4af37" />
      }
      ListHeaderComponent={
        <Text style={styles.headerHint}>
          Edit weekly functional workouts and custom client assignments. Changes update the live
          template only — past client session history is never modified.
        </Text>
      }
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Ionicons name="barbell-outline" size={40} color="#9ca3af" />
          <Text style={styles.emptyTitle}>No published workouts</Text>
          <Text style={styles.emptyText}>
            {error ?? 'Publish a workout from Content Studio to see it here.'}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Ionicons name="barbell" size={18} color="#d4af37" />
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>{formatWorkoutMeta(item)}</Text>
            <Text style={styles.subtitle}>{formatWorkoutLabel(item)}</Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => openEditor(item._id)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.title}`}
          >
            <Ionicons name="pencil" size={18} color="#92400e" />
          </TouchableOpacity>
        </View>
      )}
    />
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
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f7fb',
  },
  headerHint: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  body: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  subtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 24,
  },
});
