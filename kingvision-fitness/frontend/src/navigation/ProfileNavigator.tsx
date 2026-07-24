import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ProfileScreen from '../pages/ProfileScreen';
import UpgradeScreen from '../pages/UpgradeScreen';
import AthleteCombineScreen from '../pages/AthleteCombineScreen';
import EditProfileScreen from '../pages/EditProfileScreen';
import ProgressTrackingScreen from '../pages/ProgressTrackingScreen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Upgrade: undefined;
  AthleteCombine: undefined;
  EditProfile: {
    initial: {
      firstName: string;
      lastName: string;
      phone?: string | null;
      bio?: string;
      fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
    };
  };
  ProgressTracking: undefined;
};

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileNavigator() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
      <ProfileStack.Screen
        name="Upgrade"
        component={UpgradeScreen}
        options={{ title: 'Membership' }}
      />
      <ProfileStack.Screen
        name="AthleteCombine"
        component={AthleteCombineScreen}
        options={{ title: 'Fitness Stats', headerBackTitle: 'Profile' }}
      />
      <ProfileStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Edit Profile', headerBackTitle: 'Profile' }}
      />
      <ProfileStack.Screen
        name="ProgressTracking"
        component={ProgressTrackingScreen}
        options={{ title: 'Track Progress', headerBackTitle: 'Profile' }}
      />
    </ProfileStack.Navigator>
  );
}
