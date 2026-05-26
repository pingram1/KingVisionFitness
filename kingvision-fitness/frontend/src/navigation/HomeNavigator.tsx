import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../pages/HomeScreen';
import ClientBookingScreen from '../pages/ClientBookingScreen';
import ClientSessionsScreen from '../pages/ClientSessionsScreen';
import NutritionScreen from '../pages/NutritionScreen';

export type HomeStackParamList = {
  HomeMain: undefined;
  ClientBooking: undefined;
  ClientSessions: undefined;
  Nutrition: undefined;
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
    </HomeStack.Navigator>
  );
}
