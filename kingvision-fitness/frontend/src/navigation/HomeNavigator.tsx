import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../pages/HomeScreen';
import ClientBookingScreen from '../pages/ClientBookingScreen';
import ClientSessionsScreen from '../pages/ClientSessionsScreen';
import NutritionScreen from '../pages/NutritionScreen';
import NutritionVerificationScreen from '../pages/NutritionVerificationScreen';
import ProgressTrackingScreen from '../pages/ProgressTrackingScreen';

export type HomeStackParamList = {
  HomeMain: undefined;
  ClientBooking: undefined;
  ClientSessions: undefined;
  Nutrition: undefined;
  NutritionVerification: undefined;
  ProgressTracking: undefined;
};

const HomeStack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <HomeStack.Screen
        name="ClientBooking"
        component={ClientBookingScreen}
        options={{ title: 'Book Session', headerBackTitle: 'Home' }}
      />
      <HomeStack.Screen
        name="ClientSessions"
        component={ClientSessionsScreen}
        options={{ title: 'My Sessions', headerBackTitle: 'Home' }}
      />
      <HomeStack.Screen
        name="Nutrition"
        component={NutritionScreen}
        options={{ title: 'Nutrition & Meals', headerBackTitle: 'Home' }}
      />
      <HomeStack.Screen
        name="NutritionVerification"
        component={NutritionVerificationScreen}
        options={{ title: 'Verify Nutrition', headerBackTitle: 'Nutrition' }}
      />
      <HomeStack.Screen
        name="ProgressTracking"
        component={ProgressTrackingScreen}
        options={{ title: 'Track Progress', headerBackTitle: 'Home' }}
      />
    </HomeStack.Navigator>
  );
}
