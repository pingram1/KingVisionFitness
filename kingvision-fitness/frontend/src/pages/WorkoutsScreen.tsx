import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import type { Workout } from '../types/workout';
import type { WorkoutsStackParamList } from '../navigation/WorkoutsNavigator';
import { useFocusRefresh } from '../hooks/useFocusRefresh';
import { hasCustomWorkouts } from '../utils/subscriptionAccess';

type FilterType = 'all' | 'strength' | 'cardio' | 'hiit' | 'flexibility' | 'functional' | 'mixed';
type DifficultyFilter = 'all' | 'beginner' | 'intermediate' | 'advanced';
type WorkoutsNav = NativeStackNavigationProp<WorkoutsStackParamList, 'WorkoutsList'>;

export default function WorkoutsScreen() {
  const navigation = useNavigation<WorkoutsNav>();
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [filteredWorkouts, setFilteredWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [activeTab, setActiveTab] = useState<'weekly' | 'custom'>('weekly');
  const skipTabReloadRef = useRef(true);

  const isActiveClient = hasCustomWorkouts(user);

  const loadWorkouts = useCallback(
    async (showFullScreenLoader = true) => {
      try {
        setLoadError(null);
        if (showFullScreenLoader) setLoading(true);

        const tab = isActiveClient ? activeTab : 'weekly';

        if (tab === 'custom') {
          const response = await api.get<{ success: boolean; data: Workout[] }>('/workouts/custom');
          setWorkouts(response.data.data ?? []);
        } else {
          const response = await api.get<{ success: boolean; data: Workout[] }>(
            '/workouts/weekly'
          );
          setWorkouts(response.data.data ?? []);
        }
      } catch (error) {
        console.error('Error loading workouts:', error);
        setLoadError('Failed to load workouts. Pull to refresh or try again.');
      } finally {
        setLoading(false);
      }
    },
    [activeTab, isActiveClient]
  );

  useFocusRefresh(loadWorkouts);

  useEffect(() => {
    if (skipTabReloadRef.current) {
      skipTabReloadRef.current = false;
      return;
    }
    loadWorkouts(false);
  }, [activeTab, isActiveClient, loadWorkouts]);

  useEffect(() => {
    let filtered = [...workouts];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (workout) =>
          workout.title.toLowerCase().includes(query) ||
          (workout.description ?? '').toLowerCase().includes(query)
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((workout) => workout.type === typeFilter);
    }

    if (difficultyFilter !== 'all') {
      filtered = filtered.filter((workout) => workout.difficulty === difficultyFilter);
    }

    setFilteredWorkouts(filtered);
  }, [workouts, searchQuery, typeFilter, difficultyFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadWorkouts(false);
    } finally {
      setRefreshing(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'strength':
        return 'barbell';
      case 'cardio':
        return 'heart';
      case 'hiit':
        return 'flash';
      case 'flexibility':
        return 'body';
      case 'functional':
        return 'fitness';
      default:
        return 'fitness';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'strength':
        return '#FF5722';
      case 'cardio':
        return '#E91E63';
      case 'hiit':
        return '#FF9800';
      case 'flexibility':
        return '#4CAF50';
      case 'functional':
        return '#2196F3';
      default:
        return '#667eea';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return '#4CAF50';
      case 'intermediate':
        return '#FF9800';
      case 'advanced':
        return '#F44336';
      default:
        return '#999';
    }
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 || typeFilter !== 'all' || difficultyFilter !== 'all';

  const emptyMessage = () => {
    if (hasActiveFilters) return 'No workouts match your filters';
    if (activeTab === 'custom') return 'No custom workouts assigned to you yet';
    return 'No workouts available yet';
  };

  const startWorkout = (item: Workout) => {
    navigation.navigate('ActiveWorkout', {
      workoutId: item._id,
      workoutTitle: item.title,
    });
  };

  const renderWorkoutCard = ({ item }: { item: Workout }) => (
    <TouchableOpacity
      style={styles.workoutCard}
      onPress={() => startWorkout(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.thumbnailPlaceholder, { backgroundColor: getTypeColor(item.type) + '20' }]}>
        <Ionicons name={getTypeIcon(item.type) as keyof typeof Ionicons.glyphMap} size={32} color={getTypeColor(item.type)} />
      </View>

      <View style={styles.workoutCardContent}>
        <View style={styles.workoutHeader}>
          <View style={styles.workoutTitleContainer}>
            <Text style={styles.workoutTitle}>{item.title}</Text>
            {item.isCustom && (
              <View style={styles.customBadge}>
                <Text style={styles.customBadgeText}>Custom</Text>
              </View>
            )}
          </View>
          <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(item.difficulty) + '20' }]}>
            <Text style={[styles.difficultyText, { color: getDifficultyColor(item.difficulty) }]}>
              {item.difficulty}
            </Text>
          </View>
        </View>

        <Text style={styles.workoutDescription} numberOfLines={2}>
          {item.description || 'No description available.'}
        </Text>

        <View style={styles.workoutMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={styles.metaText}>{item.duration} min</Text>
          </View>
          {typeof item.calories === 'number' && item.calories > 0 && (
            <View style={styles.metaItem}>
              <Ionicons name="flame-outline" size={16} color="#666" />
              <Text style={styles.metaText}>~{item.calories} cal</Text>
            </View>
          )}
          {item.location && (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={16} color="#666" />
              <Text style={styles.metaText}>{item.location}</Text>
            </View>
          )}
        </View>

        <View style={styles.workoutFooter}>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.ratingText}>{(item.averageRating ?? 0).toFixed(1)}</Text>
            <Text style={styles.completionText}>({item.completionCount ?? 0} completed)</Text>
          </View>
          <TouchableOpacity style={styles.startButton} onPress={() => startWorkout(item)}>
            <Text style={styles.startButtonText}>Start</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading && workouts.length === 0 && !loadError) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading workouts…</Text>
      </View>
    );
  }

  if (loadError && workouts.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="cloud-offline-outline" size={48} color="#999" />
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadWorkouts(true)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search workouts..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {isActiveClient && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'weekly' && styles.activeTab]}
            onPress={() => setActiveTab('weekly')}
          >
            <Text style={[styles.tabText, activeTab === 'weekly' && styles.activeTabText]}>
              Weekly Workouts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'custom' && styles.activeTab]}
            onPress={() => setActiveTab('custom')}
          >
            <Text style={[styles.tabText, activeTab === 'custom' && styles.activeTabText]}>
              Custom Workouts
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, typeFilter === 'all' && styles.activeFilterChip]}
          onPress={() => setTypeFilter('all')}
        >
          <Text style={[styles.filterText, typeFilter === 'all' && styles.activeFilterText]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, typeFilter === 'strength' && styles.activeFilterChip]}
          onPress={() => setTypeFilter('strength')}
        >
          <Text style={[styles.filterText, typeFilter === 'strength' && styles.activeFilterText]}>Strength</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, typeFilter === 'cardio' && styles.activeFilterChip]}
          onPress={() => setTypeFilter('cardio')}
        >
          <Text style={[styles.filterText, typeFilter === 'cardio' && styles.activeFilterText]}>Cardio</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, typeFilter === 'hiit' && styles.activeFilterChip]}
          onPress={() => setTypeFilter('hiit')}
        >
          <Text style={[styles.filterText, typeFilter === 'hiit' && styles.activeFilterText]}>HIIT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, typeFilter === 'flexibility' && styles.activeFilterChip]}
          onPress={() => setTypeFilter('flexibility')}
        >
          <Text style={[styles.filterText, typeFilter === 'flexibility' && styles.activeFilterText]}>Flexibility</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.difficultyFiltersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, difficultyFilter === 'all' && styles.activeFilterChip]}
          onPress={() => setDifficultyFilter('all')}
        >
          <Text style={[styles.filterText, difficultyFilter === 'all' && styles.activeFilterText]}>All Levels</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, difficultyFilter === 'beginner' && styles.activeFilterChip]}
          onPress={() => setDifficultyFilter('beginner')}
        >
          <Text style={[styles.filterText, difficultyFilter === 'beginner' && styles.activeFilterText]}>Beginner</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, difficultyFilter === 'intermediate' && styles.activeFilterChip]}
          onPress={() => setDifficultyFilter('intermediate')}
        >
          <Text style={[styles.filterText, difficultyFilter === 'intermediate' && styles.activeFilterText]}>
            Intermediate
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, difficultyFilter === 'advanced' && styles.activeFilterChip]}
          onPress={() => setDifficultyFilter('advanced')}
        >
          <Text style={[styles.filterText, difficultyFilter === 'advanced' && styles.activeFilterText]}>Advanced</Text>
        </TouchableOpacity>
      </ScrollView>

      {filteredWorkouts.length > 0 ? (
        <FlatList
          data={filteredWorkouts}
          renderItem={renderWorkoutCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.emptyState}>
            <Ionicons name="fitness-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>{emptyMessage()}</Text>
            {!hasActiveFilters && activeTab === 'weekly' && (
              <Text style={styles.emptyStateSubtext}>
                Check back soon — new workouts are added each week.
              </Text>
            )}
            {!hasActiveFilters && activeTab === 'custom' && (
              <Text style={styles.emptyStateSubtext}>
                Your trainer will assign personalized workouts here.
              </Text>
            )}
            {hasActiveFilters && (
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                  setDifficultyFilter('all');
                }}
              >
                <Text style={styles.clearFiltersText}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#667eea',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  filtersContainer: {
    maxHeight: 44,
    marginBottom: 8,
  },
  difficultyFiltersContainer: {
    maxHeight: 44,
    marginBottom: 16,
  },
  filtersContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeFilterChip: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  filterText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  activeFilterText: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  workoutCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workoutCardContent: {
    padding: 16,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  workoutTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  customBadge: {
    backgroundColor: '#667eea',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  customBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  workoutDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  workoutMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  workoutFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 4,
  },
  completionText: {
    fontSize: 12,
    color: '#999',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  clearFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#667eea',
    borderRadius: 20,
  },
  clearFiltersText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
