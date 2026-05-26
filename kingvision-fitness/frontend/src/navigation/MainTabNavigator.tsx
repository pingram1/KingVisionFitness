import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import HomeNavigator from './HomeNavigator';
import ProfileNavigator from './ProfileNavigator';
import WorkoutsNavigator from './WorkoutsNavigator';
import GroupsScreen, { type GroupsStackParamList } from '../pages/GroupsScreen';
import GroupDetailScreen from '../pages/GroupDetailScreen';
import CoachAthleteDetailScreen from '../pages/CoachAthleteDetailScreen';

const KINGVISION_LOGO = require('../../assets/kingvision-logo.png');

const Tab = createBottomTabNavigator();
const GroupsStack = createNativeStackNavigator<GroupsStackParamList>();

function GroupsNavigator() {
  return (
    <GroupsStack.Navigator>
      <GroupsStack.Screen
        name="GroupsList"
        component={GroupsScreen}
        options={{ title: 'Teams & Bootcamps' }}
      />
      <GroupsStack.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={({ route }) => ({ title: route.params.groupName })}
      />
      <GroupsStack.Screen
        name="CoachAthleteDetail"
        component={CoachAthleteDetailScreen}
        options={({ route }) => ({
          title: route.params.athleteName,
          headerBackTitle: 'Team',
        })}
      />
    </GroupsStack.Navigator>
  );
}

/**
 * Standard tab bar shown to CLIENT and TRAINER roles.
 *
 * SUPER_ADMIN users see {@link AdminTabNavigator} instead, which is a superset
 * of these tabs plus an "Admin" tab.
 */
export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // Home uses the brand logo image; the rest stay on Ionicons so the
        // visual hierarchy stays clean (one branded "home" anchor, three
        // monochrome navigation tabs).
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Home') {
            return (
              <Image
                source={KINGVISION_LOGO}
                style={[
                  styles.homeLogo,
                  { width: size + 4, height: size + 4, opacity: focused ? 1 : 0.55 },
                ]}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            );
          }

          let iconName: keyof typeof Ionicons.glyphMap;
          if (route.name === 'Workouts') {
            iconName = focused ? 'barbell' : 'barbell-outline';
          } else if (route.name === 'Groups') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeNavigator}
        options={{ title: 'Home', headerShown: false }}
      />
      <Tab.Screen
        name="Workouts"
        component={WorkoutsNavigator}
        options={{ title: 'Workouts', headerShown: false }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsNavigator}
        options={{ title: 'Groups', headerShown: false }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{ title: 'Profile', headerShown: false }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  homeLogo: {
    alignSelf: 'center',
  },
});
