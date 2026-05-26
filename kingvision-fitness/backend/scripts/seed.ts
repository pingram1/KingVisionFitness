/**
 * Seed script — clears users + workouts and inserts:
 *  - 1 trainer (creator of public workouts)
 *  - 1 Test ClientZero (Basic tier) for UI testing
 *  - 5 public weekly workouts with ML meta-tags
 *
 * Run with:  npm run seed
 */

import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import User from '../src/models/User';
import Workout, { type IWorkout } from '../src/models/Workout';
import { workoutToFeatureVector, DEFAULT_VECTOR_DIM } from '../src/services/planRecommendation.service';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/kingvision-fitness';

function getCurrentWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.min(52, Math.max(1, Math.ceil((days + start.getDay() + 1) / 7)));
}

type SeedWorkoutInput = Pick<
  IWorkout,
  | 'title'
  | 'description'
  | 'type'
  | 'difficulty'
  | 'duration'
  | 'exercises'
  | 'category'
  | 'tags'
  | 'weekNumber'
  | 'dayOfWeek'
  | 'isPublic'
  | 'isCustom'
  | 'equipment'
  | 'location'
  | 'calories'
  | 'targetMuscleGroups'
  | 'metaTags'
> & { createdBy: mongoose.Types.ObjectId };

async function run() {
  console.log('[seed] Connecting to', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  console.log('[seed] Clearing users and workouts...');
  await Promise.all([User.deleteMany({}), Workout.deleteMany({})]);

  console.log('[seed] Creating trainer user...');
  const trainer = new User({
    email: 'trainer@kingvisionfitness.com',
    password: 'TrainerPass123!',
    profile: {
      firstName: 'King',
      lastName: 'Vision',
      fitnessLevel: 'advanced',
      fitnessGoals: ['strength', 'general_fitness'],
    },
    subscription: { tier: 'active-client', status: 'active' },
    subscriptionTier: 'ACTIVE_CLIENT',
    role: 'SUPER_ADMIN',
    trainer: {
      isTrainer: true,
      specializations: ['strength', 'functional', 'hiit'],
      certifications: ['NASM-CPT'],
      yearsExperience: 10,
    },
    emailVerified: true,
  });
  await trainer.save();
  console.log('[seed]   trainer._id =', trainer._id.toString());

  console.log('[seed] Creating Test ClientZero (Basic tier)...');
  const clientZero = new User({
    email: 'testclientzero@kingvisionfitness.com',
    password: 'TestPass123!',
    profile: {
      firstName: 'Test',
      lastName: 'ClientZero',
      fitnessLevel: 'beginner',
      fitnessGoals: ['general_fitness', 'weight_loss'],
      height: 178,
      initialWeight: 82,
      targetWeight: 75,
    },
    subscription: { tier: 'standard', status: 'trial' },
    subscriptionTier: 'BASIC',
    role: 'CLIENT',
    mlProfile: {
      adherenceRate: 0.55,
      similarityVector: Array.from({ length: DEFAULT_VECTOR_DIM }, () => 0),
      vectorDimension: DEFAULT_VECTOR_DIM,
      embeddingVersion: 'kv-embed-v1',
      featureBuckets: { recoveryReadiness: 0.6 },
    },
    emailVerified: true,
  });
  await clientZero.save();
  console.log('[seed]   clientZero._id =', clientZero._id.toString());

  const weekNumber = getCurrentWeekNumber();
  console.log(`[seed] Seeding workouts for current weekNumber=${weekNumber}`);

  const trainerId = trainer._id as mongoose.Types.ObjectId;

  const workouts: SeedWorkoutInput[] = [
    {
      title: 'Full-Body Foundation',
      description:
        'A balanced strength circuit designed to build base muscular endurance across all major movement patterns.',
      type: 'functional',
      difficulty: 'beginner',
      duration: 35,
      exercises: [
        { name: 'Goblet Squat', sets: 3, reps: '10-12', restTime: 60, muscleGroups: ['quadriceps', 'glutes'], equipment: 'dumbbell' },
        { name: 'Push-Up', sets: 3, reps: '8-12', restTime: 60, muscleGroups: ['chest', 'triceps', 'shoulders'], equipment: 'bodyweight' },
        { name: 'Bent-Over Row', sets: 3, reps: '10', restTime: 75, muscleGroups: ['back', 'biceps'], equipment: 'dumbbell' },
        { name: 'Plank', sets: 3, reps: '30s', duration: 30, restTime: 45, muscleGroups: ['abs', 'lower_back'], equipment: 'bodyweight' },
      ],
      category: ['full_body', 'foundation'],
      tags: ['beginner', 'full_body', 'functional'],
      weekNumber,
      dayOfWeek: 1,
      isPublic: true,
      isCustom: false,
      equipment: ['dumbbell', 'bodyweight'],
      location: 'any',
      calories: 280,
      targetMuscleGroups: ['full_body', 'chest', 'back', 'quadriceps', 'glutes', 'abs'],
      metaTags: {
        intensity: 4,
        volumeLoadIndex: 0.4,
        cardiovascularStress: 4,
        recoveryDemand: 3,
        skillComplexity: 3,
        mobilityDemand: 4,
      },
      createdBy: trainerId,
    },
    {
      title: 'HIIT Metabolic Burner',
      description:
        'High-intensity intervals alternating explosive lower-body work with conditioning to spike heart rate and burn calories.',
      type: 'hiit',
      difficulty: 'intermediate',
      duration: 25,
      exercises: [
        { name: 'Jump Squats', sets: 5, reps: '40s', duration: 40, restTime: 20, muscleGroups: ['quadriceps', 'glutes'], equipment: 'bodyweight' },
        { name: 'Burpees', sets: 5, reps: '40s', duration: 40, restTime: 20, muscleGroups: ['full_body'], equipment: 'bodyweight' },
        { name: 'Mountain Climbers', sets: 5, reps: '40s', duration: 40, restTime: 20, muscleGroups: ['abs', 'shoulders'], equipment: 'bodyweight' },
        { name: 'High Knees', sets: 5, reps: '40s', duration: 40, restTime: 30, muscleGroups: ['quadriceps', 'calves'], equipment: 'bodyweight' },
      ],
      category: ['conditioning', 'fat_loss'],
      tags: ['hiit', 'cardio', 'no_equipment'],
      weekNumber,
      dayOfWeek: 2,
      isPublic: true,
      isCustom: false,
      equipment: ['bodyweight'],
      location: 'any',
      calories: 320,
      targetMuscleGroups: ['full_body', 'quadriceps', 'glutes', 'abs'],
      metaTags: {
        intensity: 9,
        volumeLoadIndex: 0.55,
        cardiovascularStress: 9,
        recoveryDemand: 7,
        skillComplexity: 4,
        mobilityDemand: 5,
      },
      createdBy: trainerId,
    },
    {
      title: 'Upper-Body Strength Builder',
      description:
        'Progressive overload focused on pressing and pulling strength for the chest, back, and shoulders.',
      type: 'strength',
      difficulty: 'intermediate',
      duration: 50,
      exercises: [
        { name: 'Barbell Bench Press', sets: 4, reps: '6-8', restTime: 120, muscleGroups: ['chest', 'triceps', 'shoulders'], equipment: 'barbell' },
        { name: 'Pull-Up', sets: 4, reps: '6-10', restTime: 120, muscleGroups: ['back', 'lats', 'biceps'], equipment: 'pull_up_bar' },
        { name: 'Overhead Press', sets: 3, reps: '8', restTime: 90, muscleGroups: ['shoulders', 'triceps'], equipment: 'barbell' },
        { name: 'Dumbbell Row', sets: 3, reps: '10', restTime: 75, muscleGroups: ['back', 'biceps', 'lats'], equipment: 'dumbbell' },
        { name: 'Face Pull', sets: 3, reps: '12-15', restTime: 60, muscleGroups: ['shoulders', 'traps'], equipment: 'cable' },
      ],
      category: ['upper_body', 'hypertrophy'],
      tags: ['strength', 'gym', 'push_pull'],
      weekNumber,
      dayOfWeek: 3,
      isPublic: true,
      isCustom: false,
      equipment: ['barbell', 'dumbbell', 'cable', 'pull_up_bar'],
      location: 'gym',
      calories: 380,
      targetMuscleGroups: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'lats'],
      metaTags: {
        intensity: 8,
        volumeLoadIndex: 0.8,
        cardiovascularStress: 4,
        recoveryDemand: 7,
        skillComplexity: 7,
        mobilityDemand: 5,
      },
      createdBy: trainerId,
    },
    {
      title: 'Lower-Body Power & Glutes',
      description:
        'Heavy compound lifts paired with single-leg accessory work for size, strength, and posterior chain development.',
      type: 'strength',
      difficulty: 'advanced',
      duration: 55,
      exercises: [
        { name: 'Back Squat', sets: 5, reps: '5', restTime: 150, muscleGroups: ['quadriceps', 'glutes'], equipment: 'barbell' },
        { name: 'Romanian Deadlift', sets: 4, reps: '8', restTime: 120, muscleGroups: ['hamstrings', 'glutes', 'lower_back'], equipment: 'barbell' },
        { name: 'Walking Lunges', sets: 3, reps: '12 each leg', restTime: 90, muscleGroups: ['quadriceps', 'glutes'], equipment: 'dumbbell' },
        { name: 'Hip Thrust', sets: 3, reps: '10-12', restTime: 90, muscleGroups: ['glutes', 'hamstrings'], equipment: 'barbell' },
        { name: 'Standing Calf Raise', sets: 4, reps: '15', restTime: 45, muscleGroups: ['calves'], equipment: 'machine' },
      ],
      category: ['lower_body', 'strength'],
      tags: ['strength', 'gym', 'glutes', 'hypertrophy'],
      weekNumber,
      dayOfWeek: 4,
      isPublic: true,
      isCustom: false,
      equipment: ['barbell', 'dumbbell', 'machine'],
      location: 'gym',
      calories: 450,
      targetMuscleGroups: ['quadriceps', 'glutes', 'hamstrings', 'calves', 'lower_back'],
      metaTags: {
        intensity: 9,
        volumeLoadIndex: 0.9,
        cardiovascularStress: 5,
        recoveryDemand: 9,
        skillComplexity: 8,
        mobilityDemand: 6,
      },
      createdBy: trainerId,
    },
    {
      title: 'Mobility & Active Recovery Flow',
      description:
        'Low-intensity mobility flow with controlled breathing — designed to aid recovery between heavy training days.',
      type: 'flexibility',
      difficulty: 'beginner',
      duration: 20,
      exercises: [
        { name: 'Cat-Cow', sets: 2, reps: '10 cycles', restTime: 15, muscleGroups: ['lower_back', 'abs'], equipment: 'bodyweight' },
        { name: 'World’s Greatest Stretch', sets: 2, reps: '5 each side', restTime: 15, muscleGroups: ['full_body'], equipment: 'bodyweight' },
        { name: '90/90 Hip Switches', sets: 3, reps: '10', restTime: 15, muscleGroups: ['glutes', 'hamstrings'], equipment: 'bodyweight' },
        { name: 'Thoracic Rotations', sets: 2, reps: '10 each side', restTime: 15, muscleGroups: ['back', 'shoulders'], equipment: 'bodyweight' },
        { name: 'Box Breathing', sets: 1, reps: '5 min', duration: 300, restTime: 0, muscleGroups: ['full_body'], equipment: 'none' },
      ],
      category: ['recovery', 'mobility'],
      tags: ['flexibility', 'recovery', 'low_impact'],
      weekNumber,
      dayOfWeek: 5,
      isPublic: true,
      isCustom: false,
      equipment: ['bodyweight', 'none'],
      location: 'any',
      calories: 90,
      targetMuscleGroups: ['full_body', 'lower_back', 'glutes', 'hamstrings', 'back'],
      metaTags: {
        intensity: 2,
        volumeLoadIndex: 0.15,
        cardiovascularStress: 2,
        recoveryDemand: 1,
        skillComplexity: 3,
        mobilityDemand: 9,
      },
      createdBy: trainerId,
    },
  ];

  const inserted = await Workout.insertMany(workouts);
  console.log(`[seed] Inserted ${inserted.length} workouts.`);

  /** Snapshot the trainer's "expert" centroid into similarityVector for cold-start recs */
  const sumVec = Array.from({ length: DEFAULT_VECTOR_DIM }, () => 0);
  for (const w of inserted) {
    const v = workoutToFeatureVector(w as IWorkout);
    for (let i = 0; i < DEFAULT_VECTOR_DIM; i += 1) sumVec[i] += v[i];
  }
  const expertCentroid = sumVec.map((x) => x / inserted.length);

  clientZero.mlProfile.similarityVector = expertCentroid;
  clientZero.mlProfile.vectorDimension = DEFAULT_VECTOR_DIM;
  clientZero.mlProfile.lastComputedAt = new Date();
  await clientZero.save();

  console.log('[seed] Done.');
  console.log('[seed] Test login:');
  console.log('         email:    testclientzero@kingvisionfitness.com');
  console.log('         password: TestPass123!');
  console.log('       Trainer login:');
  console.log('         email:    trainer@kingvisionfitness.com');
  console.log('         password: TrainerPass123!');
}

run()
  .catch((err) => {
    console.error('[seed] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
