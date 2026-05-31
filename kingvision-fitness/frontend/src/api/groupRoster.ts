import api from '../services/api';

export interface TeamRosterMember {
  membershipId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roleLabel: string;
  joinedAt: string;
  performanceGrade: number;
}

export interface TeamRosterResponse {
  group: {
    _id: string;
    name: string;
    inviteCode: string | null;
  };
  roster: TeamRosterMember[];
}

export interface AddTeamMemberPayload {
  email: string;
  firstName: string;
  lastName: string;
}

export interface AddTeamMemberResult {
  user: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  temporaryPassword: string | null;
  createdUser: boolean;
}

export async function fetchTeamRoster(groupId: string): Promise<TeamRosterResponse> {
  const response = await api.get<{ success: boolean; data: TeamRosterResponse }>(
    `/groups/${groupId}/roster`
  );
  return response.data.data;
}

export async function addTeamMember(
  groupId: string,
  payload: AddTeamMemberPayload
): Promise<AddTeamMemberResult> {
  const response = await api.post<{ success: boolean; data: AddTeamMemberResult; message: string }>(
    `/groups/${groupId}/members`,
    payload
  );
  return response.data.data;
}

export async function removeTeamMember(groupId: string, userId: string): Promise<void> {
  await api.delete(`/groups/${groupId}/members/${userId}`);
}
