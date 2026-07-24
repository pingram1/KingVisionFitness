import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import type { GroupSummary } from '../types/group';
import { GROUP_TYPE_ICONS, getDisplayRoleLabel } from '../types/group';
import { useAuth } from '../context/AuthContext';

export type GroupsStackParamList = {
  GroupsList: undefined;
  GroupDetail: { groupId: string; groupName: string };
  CoachAthleteDetail: { groupId: string; userId: string; athleteName: string };
};

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'GroupsList'>;

export default function GroupsScreen() {
  const navigation = useNavigation<Nav>();
  const { refreshProfile } = useAuth();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);

  const loadGroups = useCallback(async (showLoader = true) => {
    try {
      setLoadError(null);
      if (showLoader) setLoading(true);
      const response = await api.get<{ success: boolean; data: GroupSummary[] }>(
        '/groups/my-groups'
      );
      setGroups(response.data.data ?? []);
    } catch (error) {
      console.error('Error loading groups:', error);
      setLoadError('Failed to load your teams. Pull to refresh or try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups(true);
  }, [loadGroups]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGroups(false);
    setRefreshing(false);
  };

  const handleJoinWithCode = async () => {
    const code = inviteCode.trim();
    if (!code) {
      Alert.alert('Invite code', 'Please enter a team or bootcamp invite code.');
      return;
    }
    try {
      setJoining(true);
      const response = await api.post<{ success: boolean; data: GroupSummary; message: string }>(
        '/groups/join',
        { inviteCode: code }
      );
      setInviteModalVisible(false);
      setInviteCode('');
      await loadGroups(false);
      await refreshProfile();
      const joined = response.data.data;
      Alert.alert('Success', response.data.message ?? `Joined ${joined.name}`, [
        {
          text: 'View team',
          onPress: () =>
            navigation.navigate('GroupDetail', {
              groupId: joined._id,
              groupName: joined.name,
            }),
        },
        { text: 'OK' },
      ]);
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      Alert.alert('Could not join', message ?? 'Invalid invite code or network error.');
    } finally {
      setJoining(false);
    }
  };

  const renderGroupCard = ({ item }: { item: GroupSummary }) => {
    const iconName = GROUP_TYPE_ICONS[item.groupType] ?? 'people';
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('GroupDetail', {
            groupId: item._id,
            groupName: item.name,
          })
        }
      >
        <View style={[styles.cardIcon, { backgroundColor: '#667eea20' }]}>
          <Ionicons name={iconName as keyof typeof Ionicons.glyphMap} size={28} color="#667eea" />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardMeta}>
            {item.groupTypeLabel}
            {item.myRoleLabel
              ? ` · ${getDisplayRoleLabel(item.groupType, item.myRole, item.myRoleLabel)}`
              : ''}
          </Text>
          <Text style={styles.cardStats}>
            {item.memberCount} members · {item.stats.totalWorkoutsCompleted} team workouts logged
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>
    );
  };

  if (loading && groups.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading your teams…</Text>
      </View>
    );
  }

  if (loadError && groups.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="cloud-offline-outline" size={48} color="#999" />
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => loadGroups(true)}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={(item) => item._id}
        renderItem={renderGroupCard}
        contentContainerStyle={groups.length === 0 ? styles.listEmpty : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          groups.length > 0 ? (
            <Text style={styles.headerSubtitle}>Your teams & bootcamps</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>
              You haven&apos;t joined any teams or bootcamps yet
            </Text>
            <Text style={styles.emptyBody}>
              Ask your coach or bootcamp lead for an invite code to join your squad.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setInviteModalVisible(true)}
            >
              <Ionicons name="key-outline" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Enter Invite Code</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {groups.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setInviteModalVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal
        visible={inviteModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Join a team or bootcamp</Text>
            <Text style={styles.modalSubtitle}>
              Enter the invite code from your coach or bootcamp organizer.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. ABC12XYZ"
              placeholderTextColor="#999"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setInviteModalVisible(false);
                  setInviteCode('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.modalJoin]}
                onPress={handleJoinWithCode}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Join</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
    backgroundColor: '#fff',
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
  list: {
    padding: 16,
    paddingBottom: 88,
  },
  listEmpty: {
    flexGrow: 1,
    padding: 16,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontWeight: '600',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '600',
    marginBottom: 4,
  },
  cardStats: {
    fontSize: 12,
    color: '#888',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#444',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    letterSpacing: 2,
    textAlign: 'center',
    color: '#333',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  modalJoin: {
    flex: 1,
  },
});
