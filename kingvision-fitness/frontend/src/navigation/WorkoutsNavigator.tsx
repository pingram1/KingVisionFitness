import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import WorkoutsScreen from '../pages/WorkoutsScreen';
import ActiveWorkoutScreen from '../pages/ActiveWorkoutScreen';

export type WorkoutsStackParamList = {
  WorkoutsList: undefined;
  ActiveWorkout: { workoutId: string; workoutTitle: string };
};

const WorkoutsStack = createNativeStackNavigator<WorkoutsStackParamList>();

export default function WorkoutsNavigator() {
  return (
    <WorkoutsStack.Navigator>
      <WorkoutsStack.Screen
        name="WorkoutsList"
        component={WorkoutsScreen}
        options={{ title: 'Workouts' }}
      />
      <WorkoutsStack.Screen
        name="ActiveWorkout"
        component={ActiveWorkoutScreen}
        options={({ route }) => ({
          title: route.params.workoutTitle,
          headerBackTitle: 'Workouts',
        })}
      />
    </WorkoutsStack.Navigator>
  );
}
