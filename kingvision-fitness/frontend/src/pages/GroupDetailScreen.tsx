import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { format } from 'date-fns';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { GroupDetail, LeaderboardEntry } from '../types/group';
import {
  GROUP_TYPE_ICONS,
  getDisplayRoleLabel,
  isPerformanceLeaderboardEntry,
  isStreakLeaderboardEntry,
} from '../types/group';
import type { GroupsStackParamList } from './GroupsScreen';

type DetailRoute = RouteProp<GroupsStackParamList, 'GroupDetail'>;
type DetailNav = NativeStackNavigationProp<GroupsStackParamList, 'GroupDetail'>;

export default function GroupDetailScreen() {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<DetailNav>();
  const { groupId } = route.params;
  const { user } = useAuth();
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'leaderboard'>('leaderboard');
  const [checkingIn, setCheckingIn] = useState(false);
  const [manageVisible, setManageVisible] = useState(false);
  const [modifyWorkoutId, setModifyWorkoutId] = useState('');
  const [modifyingWorkout, setModifyingWorkout] = useState(false);

  const loadDetail = useCallback(
    async (showLoader = true) => {
      try {
        setLoadError(null);
        if (showLoader) setLoading(true);
        const response = await api.get<{ success: boolean; data: GroupDetail }>(
          `/groups/${groupId}`
        );
        setDetail(response.data.data);
      } catch (error) {
        console.error('Error loading group detail:', error);
        setLoadError('Failed to load team details.');
      } finally {
        setLoading(false);
      }
    },
    [groupId]
  );

  useEffect(() => {
    loadDetail(true);
  }, [loadDetail]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDetail(false);
    setRefreshing(false);
  };

  const handleCheckIn = async () => {
    if (!detail) return;

    try {
      setCheckingIn(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location required',
          'Enable location access to check in at your community group.'
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const response = await api.post<{
        success: boolean;
        message: string;
        data: { streakCount: number; distanceMeters: number };
      }>(`/groups/${groupId}/check-in`, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      Alert.alert('Checked in!', response.data.message);
      await loadDetail(false);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Check-in failed. Make sure you are at the group location.';
      Alert.alert('Check-in failed', message);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleModifyWorkout = async () => {
    const workoutId = modifyWorkoutId.trim();
    if (!workoutId) {
      Alert.alert('Workout ID required', 'Enter the KingVision workout ID to clone and customize.');
      return;
    }

    try {
      setModifyingWorkout(true);
      await api.post(`/groups/${groupId}/workouts/${workoutId}/modify`, {});
      Alert.alert('Success', 'Workout customized for your team.');
      setModifyWorkoutId('');
      await loadDetail(false);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not modify workout.';
      Alert.alert('Error', message);
    } finally {
      setModifyingWorkout(false);
    }
  };

  const handlePromoteCaptain = (targetUserId: string, name: string, currentRole: string) => {
    const nextRole = currentRole === 'captain' ? 'athlete' : 'captain';
    const actionLabel = nextRole === 'captain' ? 'promote to Team Captain' : 'remove captain status from';

    Alert.alert(
      'Manage role',
      `${actionLabel} ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await api.patch(`/groups/${groupId}/members/${targetUserId}/role`, {
                role: nextRole,
              });
              await loadDetail(false);
            } catch (error: unknown) {
              const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data
                  ?.message ?? 'Could not update role.';
              Alert.alert('Error', message);
            }
          },
        },
      ]
    );
  };

  const renderRoleBadge = (role: string, roleLabel: string) => {
    if (detail?.groupType !== 'athletic_team') return null;
    if (role !== 'athlete' && role !== 'captain') return null;

    const isCaptain = role === 'captain';
    return (
      <View style={[styles.roleBadge, isCaptain && styles.captainBadge]}>
        <Text style={[styles.roleBadgeText, isCaptain && styles.captainBadgeText]}>
          {roleLabel}
        </Text>
      </View>
    );
  };

  const renderLeaderboardStat = (entry: LeaderboardEntry) => {
    if (detail?.leaderboardMode === 'performance' && isPerformanceLeaderboardEntry(entry)) {
      return (
        <>
          <Text style={styles.leaderStatValue}>{entry.performanceGrade.toFixed(1)}</Text>
          <Text style={styles.leaderStatLabel}>grade</Text>
        </>
      );
    }

    if (isStreakLeaderboardEntry(entry)) {
      return (
        <>
          <Text style={styles.leaderStatValue}>{entry.streakCount}</Text>
          <Text style={styles.leaderStatLabel}>
            {entry.streakCount === 1 ? 'day streak' : 'day streak'}
          </Text>
        </>
      );
    }

    return null;
  };

  if (loading && !detail) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  if (loadError && !detail) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadDetail(true)}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!detail) return null;

  const iconName = GROUP_TYPE_ICONS[detail.groupType] ?? 'people';
  const isCommunity = detail.groupType === 'public_community';
  const isBootcamp = detail.groupType === 'bootcamp';
  const isTeam = detail.groupType === 'athletic_team';
  const leaderboardTitle = detail.leaderboardMode === 'performance'
    ? 'Performance Leaderboard'
    : 'Streak Leaderboard';

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name={iconName as keyof typeof Ionicons.glyphMap} size={32} color="#667eea" />
          </View>
          <Text style={styles.heroTitle}>{detail.name}</Text>
          <Text style={styles.heroMeta}>
            {detail.groupTypeLabel} · {detail.memberCount} members
            {detail.myRoleLabel
              ? ` · You: ${getDisplayRoleLabel(detail.groupType, detail.myRole, detail.myRoleLabel)}`
              : ''}
          </Text>
          {(isCommunity || isBootcamp) && detail.address ? (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={16} color="#667eea" />
              <Text style={styles.addressText}>{detail.address}</Text>
            </View>
          ) : null}
          {detail.description ? (
            <Text style={styles.heroDescription}>{detail.description}</Text>
          ) : null}
        </View>

        {isBootcamp && detail.dailyWorkout ? (
          <View style={styles.dailyWorkoutCard}>
            <View style={styles.dailyWorkoutHeader}>
              <Ionicons name="today-outline" size={20} color="#667eea" />
              <Text style={styles.dailyWorkoutTitle}>Daily Workout</Text>
            </View>
            <Text style={styles.dailyWorkoutName}>{detail.dailyWorkout.title}</Text>
            <Text style={styles.dailyWorkoutMeta}>
              {detail.dailyWorkout.duration} min · {detail.dailyWorkout.difficulty} ·{' '}
              {detail.dailyWorkout.exerciseCount} exercises
            </Text>
            {detail.dailyWorkout.description ? (
              <Text style={styles.dailyWorkoutDescription}>{detail.dailyWorkout.description}</Text>
            ) : null}
          </View>
        ) : null}

        {isBootcamp && !detail.dailyWorkout ? (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={18} color="#667eea" />
            <Text style={styles.infoBannerText}>
              No daily workout assigned yet. Your coach will link one soon.
            </Text>
          </View>
        ) : null}

        {isCommunity ? (
          <View style={styles.actionSection}>
            <View style={styles.streakPill}>
              <Ionicons name="flame" size={18} color="#f59e0b" />
              <Text style={styles.streakPillText}>
                Your streak: {detail.myStreakCount} {detail.myStreakCount === 1 ? 'day' : 'days'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.checkInButton,
                (!detail.hasCheckInLocation || checkingIn) && styles.checkInButtonDisabled,
              ]}
              onPress={handleCheckIn}
              disabled={!detail.hasCheckInLocation || checkingIn}
            >
              {checkingIn ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="location" size={20} color="#fff" />
                  <Text style={styles.checkInButtonText}>Check-In (GPS)</Text>
                </>
              )}
            </TouchableOpacity>
            {!detail.hasCheckInLocation ? (
              <Text style={styles.checkInHint}>
                Check-in location not configured for this community yet.
              </Text>
            ) : detail.checkInRadiusMeters ? (
              <Text style={styles.checkInHint}>
                Must be within {detail.checkInRadiusMeters}m of the group location.
              </Text>
            ) : null}
          </View>
        ) : null}

        {isTeam && detail.isGroupCoach ? (
          <View style={styles.actionSection}>
            <TouchableOpacity style={styles.manageButton} onPress={() => setManageVisible(true)}>
              <Ionicons name="settings-outline" size={20} color="#fff" />
              <Text style={styles.manageButtonText}>Manage Team</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{detail.stats.totalWorkoutsCompleted}</Text>
            <Text style={styles.statLabel}>Team workouts</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{detail.stats.averageWorkoutsPerWeek.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg / week</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'feed' && styles.tabActive]}
            onPress={() => setActiveTab('feed')}
          >
            <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>
              Team feed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'leaderboard' && styles.tabActive]}
            onPress={() => setActiveTab('leaderboard')}
          >
            <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>
              {leaderboardTitle}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'feed' ? (
          <View style={styles.section}>
            {detail.feed.length > 0 ? (
              detail.feed.map((post) => (
                <View key={String(post._id)} style={styles.feedCard}>
                  <Text style={styles.feedContent}>{post.content}</Text>
                  {post.workoutCompleted && (
                    <View style={styles.workoutBadge}>
                      <Ionicons name="barbell-outline" size={14} color="#667eea" />
                      <Text style={styles.workoutBadgeText}>
                        Logged workout · {post.workoutCompleted.duration} min
                      </Text>
                    </View>
                  )}
                  <Text style={styles.feedMeta}>
                    {format(new Date(post.createdAt), 'MMM d, yyyy')} · {post.likeCount} likes ·{' '}
                    {post.commentCount} comments
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.inlineEmpty}>
                <Ionicons name="chatbubbles-outline" size={40} color="#ccc" />
                <Text style={styles.inlineEmptyText}>No posts in the team feed yet.</Text>
                <Text style={styles.inlineEmptySub}>
                  When members log workouts, activity will show up here.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            {detail.leaderboard.length > 0 ? (
              detail.leaderboard.map((entry) => {
                const canViewAthlete =
                  isTeam &&
                  detail.isGroupCoach &&
                  entry.role !== 'coach' &&
                  String(entry.userId) !== String(user?._id);

                const rowContent = (
                  <>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>{entry.rank}</Text>
                    </View>
                    <View style={styles.leaderBody}>
                      <View style={styles.leaderNameRow}>
                        <Text style={styles.leaderName}>{entry.name}</Text>
                        {renderRoleBadge(entry.role, entry.roleLabel)}
                      </View>
                      {!isTeam ? (
                        <Text style={styles.leaderRole}>
                          {getDisplayRoleLabel(detail.groupType, entry.role, entry.roleLabel)}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.leaderStats}>{renderLeaderboardStat(entry)}</View>
                    {canViewAthlete ? (
                      <Ionicons name="chevron-forward" size={18} color="#bbb" />
                    ) : null}
                  </>
                );

                if (canViewAthlete) {
                  return (
                    <TouchableOpacity
                      key={String(entry.userId)}
                      style={styles.leaderRow}
                      onPress={() =>
                        navigation.navigate('CoachAthleteDetail', {
                          groupId,
                          userId: String(entry.userId),
                          athleteName: entry.name,
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`View ${entry.name} performance details`}
                    >
                      {rowContent}
                    </TouchableOpacity>
                  );
                }

                return (
                  <View key={String(entry.userId)} style={styles.leaderRow}>
                    {rowContent}
                  </View>
                );
              })
            ) : (
              <View style={styles.inlineEmpty}>
                <Ionicons name="podium-outline" size={40} color="#ccc" />
                <Text style={styles.inlineEmptyText}>Leaderboard is empty.</Text>
                <Text style={styles.inlineEmptySub}>
                  {isCommunity || isBootcamp
                    ? 'Rankings update as members check in and build streaks.'
                    : 'Rankings update as athletes complete workouts.'}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={manageVisible} animationType="slide" transparent onRequestClose={() => setManageVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Team</Text>
              <TouchableOpacity onPress={() => setManageVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSectionTitle}>Customize workout</Text>
            <Text style={styles.modalHint}>
              Enter a KingVision workout ID to clone and assign to your team.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Workout ID"
              value={modifyWorkoutId}
              onChangeText={setModifyWorkoutId}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.modalPrimaryButton}
              onPress={handleModifyWorkout}
              disabled={modifyingWorkout}
            >
              {modifyingWorkout ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalPrimaryButtonText}>Clone & Assign Workout</Text>
              )}
            </TouchableOpacity>

            <Text style={[styles.modalSectionTitle, { marginTop: 20 }]}>Assign captains</Text>
            {detail.leaderboard
              .filter((entry) => entry.role === 'athlete' || entry.role === 'captain')
              .map((entry) => (
                <TouchableOpacity
                  key={String(entry.userId)}
                  style={styles.rosterRow}
                  onPress={() =>
                    handlePromoteCaptain(String(entry.userId), entry.name, entry.role)
                  }
                  disabled={String(entry.userId) === user?._id}
                >
                  <View>
                    <Text style={styles.rosterName}>{entry.name}</Text>
                    <Text style={styles.rosterRole}>{entry.roleLabel}</Text>
                  </View>
                  {String(entry.userId) !== user?._id ? (
                    <Text style={styles.rosterAction}>
                      {entry.role === 'captain' ? 'Demote' : 'Make Captain'}
                    </Text>
                  ) : (
                    <Text style={styles.rosterYou}>You</Text>
                  )}
                </TouchableOpacity>
              ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  hero: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#667eea20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  heroMeta: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    textAlign: 'center',
  },
  heroDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
  dailyWorkoutCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  dailyWorkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dailyWorkoutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#667eea',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dailyWorkoutName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  dailyWorkoutMeta: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  dailyWorkoutDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    lineHeight: 20,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#667eea15',
    borderRadius: 10,
    padding: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#667eea',
  },
  actionSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 10,
  },
  streakPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 14,
  },
  checkInButtonDisabled: {
    opacity: 0.5,
  },
  checkInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  checkInHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 14,
  },
  manageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#667eea',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  feedCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  feedContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 8,
  },
  workoutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#667eea15',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  workoutBadgeText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  feedMeta: {
    fontSize: 12,
    color: '#999',
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  leaderBody: {
    flex: 1,
  },
  leaderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  leaderName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  leaderRole: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: '#667eea15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  captainBadge: {
    backgroundColor: '#f59e0b20',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#667eea',
  },
  captainBadgeText: {
    color: '#d97706',
  },
  leaderStats: {
    alignItems: 'flex-end',
  },
  leaderStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#667eea',
  },
  leaderStatLabel: {
    fontSize: 11,
    color: '#999',
  },
  inlineEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  inlineEmptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  inlineEmptySub: {
    fontSize: 13,
    color: '#999',
    marginTop: 6,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  modalHint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  modalPrimaryButton: {
    backgroundColor: '#667eea',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  rosterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rosterName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  rosterRole: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  rosterAction: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667eea',
  },
  rosterYou: {
    fontSize: 13,
    color: '#999',
  },
});
