import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import type { AdminGroupRoster, AdminRosterMember } from '../../types/group';
import type { AdminTeamsStackParamList } from '../../navigation/AdminTeamsNavigator';

type RosterRoute = RouteProp<AdminTeamsStackParamList, 'GroupRoster'>;

interface AssignCoachResponse {
  user: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  createdUser: boolean;
}

function parseApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string } } }).response?.data;
    if (typeof data?.message === 'string' && data.message) return data.message;
  }
  return fallback;
}

function tierLabel(tier: string): string {
  if (tier === 'ACTIVE_CLIENT') return 'Active Client';
  if (tier === 'SPECIFIED') return 'Specified';
  return 'Basic';
}

function MemberCard({ member }: { member: AdminRosterMember }) {
  const fullName = `${member.firstName} ${member.lastName}`.trim() || member.email;
  const isCoach = member.role === 'coach';

  return (
    <View style={[styles.memberRow, isCoach && styles.coachRow]}>
      <View style={[styles.avatar, isCoach && styles.coachAvatar]}>
        <Text style={styles.avatarText}>
          {(member.firstName?.[0] ?? member.email?.[0] ?? '?').toUpperCase()}
        </Text>
      </View>
      <View style={styles.memberBody}>
        <Text style={[styles.memberName, isCoach && styles.coachMemberName]}>{fullName}</Text>
        <Text style={[styles.memberEmail, isCoach && styles.coachMemberEmail]}>{member.email}</Text>
        <View style={styles.memberMetaRow}>
          <View style={[styles.roleBadge, isCoach && styles.coachRoleBadge]}>
            <Text style={[styles.roleBadgeText, isCoach && styles.coachRoleBadgeText]}>
              {member.roleLabel}
            </Text>
          </View>
          <View style={styles.tierBadge}>
            <Text style={styles.tierBadgeText}>{tierLabel(member.subscriptionTier)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function AdminGroupRosterScreen() {
  const route = useRoute<RosterRoute>();
  const { groupId } = route.params;

  const [data, setData] = useState<AdminGroupRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [assignVisible, setAssignVisible] = useState(false);
  const [coachEmail, setCoachEmail] = useState('');
  const [coachFirstName, setCoachFirstName] = useState('');
  const [coachLastName, setCoachLastName] = useState('');
  const [assigning, setAssigning] = useState(false);

  const loadRoster = useCallback(async () => {
    try {
      setLoadError(null);
      const response = await api.get<{ success: boolean; data: AdminGroupRoster }>(
        `/groups/admin/${groupId}/roster`
      );
      setData(response.data.data);
    } catch (error) {
      console.error('Failed to load roster:', error);
      setLoadError(parseApiError(error, 'Could not load roster.'));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRoster();
    setRefreshing(false);
  }, [loadRoster]);

  const { coaches, athletes } = useMemo(() => {
    const roster = data?.roster ?? [];
    return {
      coaches: roster.filter((m) => m.role === 'coach'),
      athletes: roster.filter((m) => m.role !== 'coach'),
    };
  }, [data]);

  const isAthleticTeam = data?.group.groupType === 'athletic_team';

  const resetAssignForm = () => {
    setCoachEmail('');
    setCoachFirstName('');
    setCoachLastName('');
  };

  const handleAssignCoach = async () => {
    const email = coachEmail.trim().toLowerCase();
    const firstName = coachFirstName.trim();
    const lastName = coachLastName.trim();

    if (!email || !firstName || !lastName) {
      Alert.alert('Missing fields', 'Email, first name, and last name are all required.');
      return;
    }

    try {
      setAssigning(true);
      const response = await api.post<{
        success: boolean;
        message: string;
        data: AssignCoachResponse;
      }>(`/groups/admin/${groupId}/assign-coach`, {
        email,
        firstName,
        lastName,
      });

      setAssignVisible(false);
      resetAssignForm();
      await loadRoster();

      const { createdUser, user } = response.data.data;
      if (createdUser) {
        Alert.alert(
          'Coach Created',
          `${user.firstName} ${user.lastName} was assigned as coach.\n\nAsk them to use "Forgot password" on the login screen to set their credentials.`,
          [{ text: 'Got it' }]
        );
      } else {
        Alert.alert('Coach Assigned', response.data.message);
      }
    } catch (error) {
      Alert.alert('Assign failed', parseApiError(error, 'Could not assign coach.'));
    } finally {
      setAssigning(false);
    }
  };

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#d4af37" />
        <Text style={styles.loadingText}>Loading roster…</Text>
      </View>
    );
  }

  const roster = data?.roster ?? [];

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4af37" />
        }
      >
        {data?.group.inviteCode ? (
          <View style={styles.inviteBanner}>
            <Text style={styles.inviteLabel}>Invite Code</Text>
            <Text style={styles.inviteCode}>{data.group.inviteCode}</Text>
            <Text style={styles.inviteMeta}>
              {data.group.groupTypeLabel} · {roster.length} member{roster.length === 1 ? '' : 's'}
            </Text>
          </View>
        ) : null}

        {loadError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity onPress={loadRoster}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isAthleticTeam ? (
          <View style={styles.coachSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.coachSectionTitle}>Coaching Staff</Text>
                <Text style={styles.sectionSubtitle}>
                  Coaches are assigned by Admin only. Global role stays CLIENT.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.assignButton}
                onPress={() => setAssignVisible(true)}
              >
                <Ionicons name="person-add-outline" size={16} color="#fff" />
                <Text style={styles.assignButtonText}>Assign Coach</Text>
              </TouchableOpacity>
            </View>

            {coaches.length === 0 ? (
              <View style={styles.coachEmpty}>
                <Ionicons name="shield-outline" size={28} color="#9ca3af" />
                <Text style={styles.coachEmptyText}>No coaches assigned yet.</Text>
              </View>
            ) : (
              coaches.map((member) => <MemberCard key={member.userId} member={member} />)
            )}
          </View>
        ) : null}

        <View style={styles.rosterSection}>
          <Text style={styles.sectionTitle}>
            {isAthleticTeam ? 'Team Roster' : 'Members'}
          </Text>
          {roster.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="person-outline" size={36} color="#9ca3af" />
              <Text style={styles.emptyTitle}>No members yet</Text>
              <Text style={styles.emptyBody}>
                Share the invite code so coaches and athletes can join this group.
              </Text>
            </View>
          ) : athletes.length === 0 && isAthleticTeam ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={36} color="#9ca3af" />
              <Text style={styles.emptyTitle}>No athletes yet</Text>
              <Text style={styles.emptyBody}>
                Athletes join via the invite code. Coaches are assigned above.
              </Text>
            </View>
          ) : (
            (isAthleticTeam ? athletes : roster).map((member) => (
              <MemberCard key={member.userId} member={member} />
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={assignVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAssignVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Coach</Text>
              <TouchableOpacity onPress={() => setAssignVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalHint}>
              If the email is new, a CLIENT account is created with a temporary password.
              Existing users keep their subscription tier — only their group role changes to Coach.
            </Text>

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.modalInput}
              value={coachEmail}
              onChangeText={setCoachEmail}
              placeholder="coach@example.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.inputLabel}>First Name</Text>
            <TextInput
              style={styles.modalInput}
              value={coachFirstName}
              onChangeText={setCoachFirstName}
              placeholder="Jordan"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
            />

            <Text style={styles.inputLabel}>Last Name</Text>
            <TextInput
              style={styles.modalInput}
              value={coachLastName}
              onChangeText={setCoachLastName}
              placeholder="Smith"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
            />

            <TouchableOpacity
              style={[styles.modalPrimaryButton, assigning && styles.modalPrimaryDisabled]}
              onPress={handleAssignCoach}
              disabled={assigning}
            >
              {assigning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalPrimaryText}>Assign Coach</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f7fb' },
  content: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f7fb',
  },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6b7280' },
  inviteBanner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  inviteLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inviteCode: {
    fontSize: 28,
    fontWeight: '800',
    color: '#92400e',
    letterSpacing: 4,
    marginTop: 4,
  },
  inviteMeta: { fontSize: 12, color: '#b45309', marginTop: 6 },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 14, marginBottom: 16 },
  errorText: { fontSize: 13, color: '#991b1b' },
  retryText: { fontSize: 13, color: '#b45309', fontWeight: '600', marginTop: 8 },
  coachSection: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  coachSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f9fafb',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
    lineHeight: 16,
    maxWidth: 220,
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#d4af37',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  assignButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  coachEmpty: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  coachEmptyText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  rosterSection: {
    gap: 10,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 12 },
  emptyBody: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 6 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  coachRow: {
    backgroundColor: '#374151',
    marginBottom: 8,
  },
  coachMemberName: { color: '#f9fafb' },
  coachMemberEmail: { color: '#d1d5db' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachAvatar: {
    backgroundColor: '#d4af37',
  },
  avatarText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  memberBody: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  memberEmail: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  memberMetaRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  roleBadge: {
    backgroundColor: '#e0e7ff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  coachRoleBadge: {
    backgroundColor: '#fef3c7',
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700', color: '#3730a3' },
  coachRoleBadgeText: { color: '#92400e' },
  tierBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tierBadgeText: { fontSize: 10, fontWeight: '600', color: '#4b5563' },
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
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalHint: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  modalPrimaryButton: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  modalPrimaryDisabled: { opacity: 0.7 },
  modalPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
