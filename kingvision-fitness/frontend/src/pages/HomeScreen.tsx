import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

interface DashboardStats {
  workoutsCompleted: number;
  totalMinutes: number;
  currentStreak: number;
  weeklyWorkouts: number;
  upcomingWorkouts: any[];
  recentActivity: any[];
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user, refreshUser } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API endpoint when backend is ready
      // const response = await api.get('/users/dashboard');
      // setStats(response.data.data);

      // Mock data for now
      const mockStats: DashboardStats = {
        workoutsCompleted: user?.completedWorkouts?.length || 0,
        totalMinutes: 0,
        currentStreak: 7,
        weeklyWorkouts: 3,
        upcomingWorkouts: [],
        recentActivity: [],
      };

      // Calculate total minutes from completed workouts
      if (user?.completedWorkouts) {
        mockStats.totalMinutes = user.completedWorkouts.reduce(
          (sum: number, workout: any) => sum + (workout.duration || 0),
          0
        );
      }

      setStats(mockStats);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshUser();
    await loadDashboardData();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (loading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header Section */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {getGreeting()}, {user?.profile?.firstName || 'User'}! 👋
          </Text>
          <Text style={styles.subtitle}>
            {user?.subscription?.tier === 'active-client'
              ? 'Active Client'
              : 'Standard Member'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => {
            // TODO: Navigate to notifications
            Alert.alert('Notifications', 'Feature coming soon');
          }}
        >
          <Ionicons name="notifications-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          </View>
          <Text style={styles.statValue}>{stats?.workoutsCompleted || 0}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
          <Text style={styles.statSubLabel}>Completed</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="time-outline" size={24} color="#2196F3" />
          </View>
          <Text style={styles.statValue}>{stats?.totalMinutes || 0}</Text>
          <Text style={styles.statLabel}>Minutes</Text>
          <Text style={styles.statSubLabel}>Total Time</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="flame" size={24} color="#FF9800" />
          </View>
          <Text style={styles.statValue}>{stats?.currentStreak || 0}</Text>
          <Text style={styles.statLabel}>Day</Text>
          <Text style={styles.statSubLabel}>Streak</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Workouts' as never)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#667eea20' }]}>
              <Ionicons name="barbell" size={28} color="#667eea" />
            </View>
            <Text style={styles.quickActionText}>Start Workout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Groups' as never)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#4CAF5020' }]}>
              <Ionicons name="people" size={28} color="#4CAF50" />
            </View>
            <Text style={styles.quickActionText}>Join Group</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => {
              // TODO: Navigate to progress tracking
              Alert.alert('Progress', 'Feature coming soon');
            }}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#FF980020' }]}>
              <Ionicons name="stats-chart" size={28} color="#FF9800" />
            </View>
            <Text style={styles.quickActionText}>Track Progress</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Weekly Progress */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Workouts' as never)}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.weeklyCard}>
          <View style={styles.weeklyStat}>
            <Text style={styles.weeklyValue}>{stats?.weeklyWorkouts || 0}</Text>
            <Text style={styles.weeklyLabel}>Workouts This Week</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min((stats?.weeklyWorkouts || 0) * 20, 100)}%` },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Subscription Status */}
      {user?.subscription?.tier === 'standard' && (
        <TouchableOpacity
          style={styles.upgradeCard}
          onPress={() => {
            // TODO: Navigate to subscription upgrade
            Alert.alert('Upgrade', 'Upgrade to Active Client for custom workouts and more!');
          }}
        >
          <View style={styles.upgradeContent}>
            <View>
              <Text style={styles.upgradeTitle}>Upgrade to Active Client</Text>
              <Text style={styles.upgradeText}>
                Get custom workouts, meal plans, and direct trainer access
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={24} color="#667eea" />
          </View>
        </TouchableOpacity>
      )}

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {user?.completedWorkouts && user.completedWorkouts.length > 0 ? (
          <View style={styles.activityList}>
            {user.completedWorkouts.slice(0, 3).map((workout: any, index: number) => (
              <View key={index} style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityText}>Completed workout</Text>
                  <Text style={styles.activityDate}>
                    {format(new Date(workout.completedAt), 'MMM d, yyyy')}
                  </Text>
                </View>
                <Text style={styles.activityDuration}>{workout.duration} min</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="fitness-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No workouts completed yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Start your fitness journey today!
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => navigation.navigate('Workouts' as never)}
            >
              <Text style={styles.emptyStateButtonText}>Browse Workouts</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    paddingTop: 60,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  notificationButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  statSubLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  section: {
    padding: 20,
    backgroundColor: '#fff',
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
    textAlign: 'center',
  },
  weeklyCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
  },
  weeklyStat: {
    marginBottom: 12,
  },
  weeklyValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 4,
  },
  weeklyLabel: {
    fontSize: 14,
    color: '#666',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 4,
  },
  upgradeCard: {
    margin: 20,
    marginTop: 12,
    backgroundColor: '#667eea',
    borderRadius: 16,
    padding: 20,
  },
  upgradeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  upgradeText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  activityIcon: {
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  activityDate: {
    fontSize: 12,
    color: '#999',
  },
  activityDuration: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});


