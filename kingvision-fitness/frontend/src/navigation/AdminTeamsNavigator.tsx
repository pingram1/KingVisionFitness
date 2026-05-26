import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AdminTeamsScreen from '../pages/Admin/AdminTeamsScreen';
import AdminGroupRosterScreen from '../pages/Admin/AdminGroupRosterScreen';

export type AdminTeamsStackParamList = {
  TeamsMain: undefined;
  GroupRoster: { groupId: string; groupName: string };
};

const AdminTeamsStack = createNativeStackNavigator<AdminTeamsStackParamList>();

export default function AdminTeamsNavigator() {
  return (
    <AdminTeamsStack.Navigator>
      <AdminTeamsStack.Screen
        name="TeamsMain"
        component={AdminTeamsScreen}
        options={{ title: 'Teams' }}
      />
      <AdminTeamsStack.Screen
        name="GroupRoster"
        component={AdminGroupRosterScreen}
        options={({ route }) => ({
          title: route.params.groupName,
          headerBackTitle: 'Teams',
        })}
      />
    </AdminTeamsStack.Navigator>
  );
}
