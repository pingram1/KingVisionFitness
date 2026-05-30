import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AdminContentScreen from '../pages/Admin/AdminContentScreen';
import AdminWorkoutsScreen from '../pages/Admin/AdminWorkoutsScreen';
import AdminWorkoutForm from '../pages/Admin/AdminWorkoutForm';

export type AdminContentStackParamList = {
  ContentStudio: undefined;
  AdminWorkouts: undefined;
  AdminWorkoutForm: { workoutId: string };
};

const AdminContentStack = createNativeStackNavigator<AdminContentStackParamList>();

export default function AdminContentNavigator() {
  return (
    <AdminContentStack.Navigator>
      <AdminContentStack.Screen
        name="ContentStudio"
        component={AdminContentScreen}
        options={{ title: 'Content' }}
      />
      <AdminContentStack.Screen
        name="AdminWorkouts"
        component={AdminWorkoutsScreen}
        options={{ title: 'Published Workouts' }}
      />
      <AdminContentStack.Screen
        name="AdminWorkoutForm"
        component={AdminWorkoutForm}
        options={{ title: 'Edit Workout' }}
      />
    </AdminContentStack.Navigator>
  );
}
