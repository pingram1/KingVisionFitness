import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import AdminHomeScreen from '../pages/Admin/AdminHomeScreen';
import AdminScheduleScreen from '../pages/Admin/AdminScheduleScreen';
import AdminBillingScreen from '../pages/Admin/AdminBillingScreen';
import AdminContentNavigator from './AdminContentNavigator';
import AdminTeamsNavigator from './AdminTeamsNavigator';

const Tab = createBottomTabNavigator();

/**
 * Tab bar shown ONLY to SUPER_ADMIN users.
 *
 * This is a fully isolated admin shell — no client screens are imported here.
 * Admins never see HomeScreen, WorkoutsScreen, ProfileScreen, "Upgrade
 * Membership" prompts, etc. The owner's logout control lives in the header of
 * the Admin Home tab.
 *
 * Tabs (in order):
 *   1. Home     — high-level business metrics
 *   2. Schedule — bookings + availability
 *   3. Billing  — Stripe, revenue, invoices
 *   4. Content  — workout / meal plan authoring
 *   5. Teams    — bootcamps, coaches, group management
 *
 * NOTE: Client-side gating is for UX only. Sensitive admin endpoints must
 * additionally be protected by `authorizeRoles('SUPER_ADMIN')` on the backend.
 */
export default function AdminTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;
          switch (route.name) {
            case 'Home':
              iconName = focused ? 'speedometer' : 'speedometer-outline';
              break;
            case 'Schedule':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'Billing':
              iconName = focused ? 'card' : 'card-outline';
              break;
            case 'Content':
              iconName = focused ? 'create' : 'create-outline';
              break;
            case 'Teams':
              iconName = focused ? 'shield' : 'shield-outline';
              break;
            default:
              iconName = 'help-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#d4af37',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e5e7eb',
        },
        tabBarLabelStyle: {
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#1f2937',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          color: '#ffffff',
          fontWeight: '700',
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={AdminHomeScreen}
        options={{ title: 'Admin Overview' }}
      />
      <Tab.Screen
        name="Schedule"
        component={AdminScheduleScreen}
        options={{ title: 'Schedule' }}
      />
      <Tab.Screen
        name="Billing"
        component={AdminBillingScreen}
        options={{ title: 'Billing' }}
      />
      <Tab.Screen
        name="Content"
        component={AdminContentNavigator}
        options={{ title: 'Content', headerShown: false }}
      />
      <Tab.Screen
        name="Teams"
        component={AdminTeamsNavigator}
        options={{ title: 'Teams', headerShown: false }}
      />
    </Tab.Navigator>
  );
}
