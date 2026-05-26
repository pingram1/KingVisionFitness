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
  Modal,
  TextInput,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '../../services/api';
import type { AdminGroupSummary, GroupType } from '../../types/group';
import { GROUP_TYPE_ICONS, GROUP_TYPE_OPTIONS } from '../../types/group';
import type { AdminTeamsStackParamList } from '../../navigation/AdminTeamsNavigator';

type Nav = NativeStackNavigationProp<AdminTeamsStackParamList, 'TeamsMain'>;
type FormMode = 'create' | 'edit';

function parseApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string } } }).response?.data;
    if (typeof data?.message === 'string' && data.message) return data.message;
  }
  return fallback;
}

async function geocodeAddress(address: string) {
  const geocoded = await Location.geocodeAsync(address.trim());
  if (!geocoded.length) {
    throw new Error('Address not found');
  }
  const { latitude, longitude } = geocoded[0];
  return { latitude, longitude, radiusMeters: 150 };
}

/**
 * SUPER_ADMIN portal — create teams/bootcamps/communities, distribute invite
 * codes, and drill into rosters.
 */
export default function AdminTeamsScreen() {
  const navigation = useNavigation<Nav>();

  const [groups, setGroups] = useState<AdminGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupType, setGroupType] = useState<GroupType>('athletic_team');
  const [address, setAddress] = useState('');
  const [originalAddress, setOriginalAddress] = useState('');

  const needsAddress = groupType === 'public_community' || groupType === 'bootcamp';

  const loadGroups = useCallback(async () => {
    try {
      setLoadError(null);
      const response = await api.get<{ success: boolean; data: AdminGroupSummary[] }>(
        '/groups/admin'
      );
      setGroups(response.data.data ?? []);
    } catch (error) {
      console.error('Failed to load admin groups:', error);
      setLoadError(parseApiError(error, 'Could not load groups.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGroups();
    setRefreshing(false);
  }, [loadGroups]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setGroupType('athletic_team');
    setAddress('');
    setOriginalAddress('');
    setEditingGroupId(null);
    setFormMode('create');
  };

  const openCreateModal = () => {
    resetForm();
    setFormMode('create');
    setModalVisible(true);
  };

  const openEditModal = (group: AdminGroupSummary) => {
    setFormMode('edit');
    setEditingGroupId(group._id);
    setName(group.name);
    setDescription(group.description);
    setGroupType(group.groupType);
    const savedAddress = group.address ?? '';
    setAddress(savedAddress);
    setOriginalAddress(savedAddress);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    resetForm();
  };

  const buildLocationPayload = async () => {
    if (!needsAddress) {
      return undefined;
    }

    if (!address.trim()) {
      Alert.alert('Address required', 'Enter a street address for check-in location.');
      return null;
    }

    const addressChanged = address.trim() !== originalAddress.trim();
    if (formMode === 'edit' && !addressChanged) {
      return undefined;
    }

    try {
      const coords = await geocodeAddress(address.trim());
      return {
        address: address.trim(),
        location: coords,
      };
    } catch {
      Alert.alert(
        'Address not found',
        'Could not locate that address. Try a full street address with city and state.'
      );
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      Alert.alert('Missing fields', 'Name and description are required.');
      return;
    }

    try {
      setSubmitting(true);

      const locationPayload = await buildLocationPayload();
      if (locationPayload === null) {
        return;
      }

      const payload = {
        name: name.trim(),
        description: description.trim(),
        groupType,
        ...(locationPayload ?? {}),
      };

      if (formMode === 'create') {
        const response = await api.post<{ success: boolean; data: AdminGroupSummary }>(
          '/groups/admin',
          payload
        );
        closeModal();
        await loadGroups();
        const created = response.data.data;
        Alert.alert(
          'Group created',
          `"${created.name}" is ready. Invite code: ${created.inviteCode ?? '—'}`
        );
      } else if (editingGroupId) {
        await api.put<{ success: boolean; data: AdminGroupSummary }>(
          `/groups/admin/${editingGroupId}`,
          payload
        );
        closeModal();
        await loadGroups();
        Alert.alert('Group updated', `"${name.trim()}" has been saved.`);
      }
    } catch (error) {
      Alert.alert(
        formMode === 'create' ? 'Create failed' : 'Update failed',
        parseApiError(error, formMode === 'create' ? 'Could not create group.' : 'Could not update group.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const shareInviteCode = async (group: AdminGroupSummary) => {
    if (!group.inviteCode) {
      Alert.alert('No code', 'This group does not have an invite code yet.');
      return;
    }
    try {
      await Share.share({
        message: `Join ${group.name} on KingVision Fitness! Invite code: ${group.inviteCode}`,
      });
    } catch {
      Alert.alert('Invite code', group.inviteCode);
    }
  };

  if (loading && groups.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#d4af37" />
        <Text style={styles.loadingText}>Loading teams…</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4af37" />
        }
      >
        <View style={styles.heroCard}>
          <Ionicons name="shield" size={28} color="#d4af37" />
          <Text style={styles.heroTitle}>Teams & Groups</Text>
          <Text style={styles.heroSubtitle}>
            Create athletic teams, bootcamps, and communities. Share invite codes with coaches
            and members.
          </Text>
        </View>

        <TouchableOpacity style={styles.createButton} onPress={openCreateModal}>
          <Ionicons name="add-circle-outline" size={20} color="#1f2937" />
          <Text style={styles.createButtonText}>Create New Group</Text>
        </TouchableOpacity>

        {loadError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity onPress={loadGroups}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={36} color="#9ca3af" />
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptyBody}>
              Create your first team or bootcamp and share the invite code with members.
            </Text>
          </View>
        ) : (
          groups.map((group) => {
            const icon = GROUP_TYPE_ICONS[group.groupType] ?? 'people';
            return (
              <View key={group._id} style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <View style={styles.groupIconWrap}>
                    <Ionicons name={icon} size={22} color="#d4af37" />
                  </View>
                  <View style={styles.groupTitleBlock}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{group.groupTypeLabel}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => openEditModal(group)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${group.name}`}
                  >
                    <Ionicons name="pencil-outline" size={18} color="#92400e" />
                  </TouchableOpacity>
                  <Text style={styles.memberCount}>{group.memberCount} members</Text>
                </View>

                {group.description ? (
                  <Text style={styles.groupDescription} numberOfLines={2}>
                    {group.description}
                  </Text>
                ) : null}

                <TouchableOpacity
                  style={styles.inviteCodeRow}
                  onPress={() => shareInviteCode(group)}
                  accessibilityRole="button"
                  accessibilityLabel={`Share invite code ${group.inviteCode}`}
                >
                  <View>
                    <Text style={styles.inviteLabel}>Invite Code</Text>
                    <Text style={styles.inviteCode}>{group.inviteCode ?? '—'}</Text>
                  </View>
                  <View style={styles.copyHint}>
                    <Ionicons name="share-outline" size={16} color="#92400e" />
                    <Text style={styles.copyHintText}>Share</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.rosterButton}
                  onPress={() =>
                    navigation.navigate('GroupRoster', {
                      groupId: group._id,
                      groupName: group.name,
                    })
                  }
                >
                  <Ionicons name="list-outline" size={18} color="#1f2937" />
                  <Text style={styles.rosterButtonText}>View Roster</Text>
                  <Ionicons name="chevron-forward" size={18} color="#6b7280" />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {formMode === 'create' ? 'Create New Group' : 'Edit Group'}
            </Text>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Varsity Football"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Spring season training group"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />

            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typePickerRow}>
              {GROUP_TYPE_OPTIONS.map((opt) => {
                const active = groupType === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.typeChip, active && styles.typeChipActive]}
                    onPress={() => setGroupType(opt.value)}
                  >
                    <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {needsAddress ? (
              <>
                <Text style={styles.fieldLabel}>Address</Text>
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="700 Central Ave, Louisville, KY 40208"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                <Text style={styles.fieldHint}>
                  Used for GPS check-ins. We&apos;ll geocode this address automatically when you
                  {formMode === 'create' ? ' create' : ' save'} the group.
                  {formMode === 'edit' && originalAddress.trim()
                    ? ' Leave unchanged to keep the current coordinates.'
                    : null}
                </Text>
              </>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={closeModal}
                disabled={submitting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, submitting && styles.modalSubmitDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#1f2937" />
                ) : (
                  <Text style={styles.modalSubmitText}>
                    {formMode === 'create' ? 'Create & Generate Code' : 'Save Changes'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            </View>
          </ScrollView>
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
  heroTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 10 },
  heroSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 6, lineHeight: 20 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#d4af37',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  createButtonText: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 14, marginBottom: 12 },
  errorText: { fontSize: 13, color: '#991b1b' },
  retryText: { fontSize: 13, color: '#b45309', fontWeight: '600', marginTop: 8 },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 12 },
  emptyBody: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 6 },
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  groupHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  groupIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fffbeb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitleBlock: { flex: 1 },
  groupName: { fontSize: 17, fontWeight: '700', color: '#111827' },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '600', color: '#4b5563' },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCount: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  groupDescription: { fontSize: 13, color: '#6b7280', marginTop: 10, lineHeight: 18 },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  inviteLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inviteCode: {
    fontSize: 22,
    fontWeight: '800',
    color: '#92400e',
    letterSpacing: 3,
    marginTop: 2,
  },
  copyHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyHintText: { fontSize: 12, fontWeight: '600', color: '#92400e' },
  rosterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fafafa',
  },
  rosterButtonText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1f2937' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalScroll: { maxHeight: '92%' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 16 },
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
    marginBottom: 14,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  fieldHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: -8,
    marginBottom: 16,
    lineHeight: 17,
  },
  typePickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fafafa',
  },
  typeChipActive: { borderColor: '#d4af37', backgroundColor: '#fffbeb' },
  typeChipText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  typeChipTextActive: { color: '#92400e' },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  modalSubmit: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#d4af37',
  },
  modalSubmitDisabled: { opacity: 0.7 },
  modalSubmitText: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
});
