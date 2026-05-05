# KingVision Fitness

A mobile fitness coaching application built with React Native (Expo) and Node.js, designed for wellness coaches to provide personalized training, nutrition guidance, and community features to their clients.

## 📱 Overview

KingVision Fitness is a comprehensive mobile application that enables fitness coaches to:
- Deliver personalized workout plans and meal programs
- Track client progress and provide real-time feedback
- Build community through groups and challenges
- Schedule one-on-one sessions with active clients
- Communicate via messaging and video calls

## 🏗️ Architecture

### Frontend (Mobile App)
- **Framework**: React Native with Expo
- **Navigation**: React Navigation (Stack & Tab Navigators)
- **State Management**: React Context API
- **Storage**: AsyncStorage for local data persistence
- **HTTP Client**: Axios
- **Forms**: React Hook Form with Yup validation
- **UI Components**: React Native components with Expo Vector Icons

### Backend (API Server)
- **Framework**: Express.js with TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.io for messaging and video calls
- **Authentication**: JWT (access + refresh tokens)
- **Payment**: Stripe integration
- **Email**: SendGrid (production) / Nodemailer (development)
- **File Storage**: Cloudinary for images/videos

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- MongoDB (local or cloud instance)
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for Mac) or Android Studio (for Android development)

### Installation

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd KingVisionFitness/kingvision-fitness
```

#### 2. Backend Setup

```bash
cd backend
npm install

# Create a .env file in the backend directory
cp .env.example .env
# Edit .env with your configuration

# Start MongoDB (if running locally)
# mongod

# Start the development server
npm run dev
```

The backend API will run on `http://localhost:5000`

#### 3. Frontend Setup

```bash
cd frontend
npm install

# For iOS development
npm run ios

# For Android development
npm run android

# For web (development/testing)
npm run web

# Start Expo development server
npm start
```

### Environment Variables

#### Backend (.env)

```env
# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:8081

# Database
MONGODB_URI=mongodb://localhost:27017/kingvision-fitness

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRE=30d

# Email
SENDGRID_API_KEY=your-sendgrid-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@kingvisionfitness.com

# App URLs
APP_URL=http://localhost:5000

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Admin
ADMIN_EMAILS=admin@example.com
```

#### Frontend (app.config.js or .env)

Update `app.config.js` to include your API URL:

```javascript
extra: {
  apiUrl: 'http://localhost:5000/api', // Development
  // For production, use your deployed API URL
  // apiUrl: 'https://api.kingvisionfitness.com/api'
}
```

**Note**: For physical devices, replace `localhost` with your computer's local IP address (e.g., `http://192.168.1.100:5000/api`)

## 📱 Mobile App Development

### Running on Physical Devices

1. **iOS (iPhone/iPad)**:
   - Install Expo Go from the App Store
   - Scan the QR code from `npm start`
   - Or use `npm run ios` for iOS Simulator

2. **Android**:
   - Install Expo Go from Google Play Store
   - Scan the QR code from `npm start`
   - Or use `npm run android` for Android Emulator

### Building for Production

#### Using Expo Application Services (EAS)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure build
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

#### Manual Build

```bash
# Generate native code
expo prebuild

# iOS (requires Xcode)
cd ios
pod install
# Open in Xcode and build

# Android (requires Android Studio)
cd android
./gradlew assembleRelease
```

## 🎯 Features

### User Features
- ✅ User registration and authentication
- ✅ Email verification
- ✅ Password reset functionality
- ✅ Profile management with fitness metrics
- ✅ Progress tracking (weight, measurements, photos)
- ✅ Workout completion tracking
- ✅ Subscription management (Standard & Active Client tiers)

### Workout Features
- 📋 Weekly public workouts
- 🎯 Custom workout plans for active clients
- 📹 Exercise videos and instructions
- ⏱️ Workout duration tracking
- ⭐ Workout ratings and reviews

### Community Features
- 👥 Public and private groups
- 📝 Group posts with images
- 💬 Comments and likes
- 🏆 Group challenges
- 📢 Group announcements
- 🔗 Invite codes and links

### Communication
- 💬 Direct messaging (real-time)
- 📱 Group messaging
- 📹 Video call support (via Socket.io)
- 🔔 Push notifications (Expo Notifications)

### Nutrition
- 🥗 Weekly recipes
- 📋 Custom meal plans (Active Client)
- 📊 Nutrition tracking

### Scheduling (Active Client Only)
- 📅 Session booking
- 🗓️ Trainer availability
- 📝 Session management

## 📂 Project Structure

```
kingvision-fitness/
├── backend/
│   ├── src/
│   │   ├── middleware/      # Auth & validation middleware
│   │   ├── models/          # Mongoose models (User, Workout, Group)
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Email service, etc.
│   │   └── server.ts        # Express server setup
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable React Native components
│   │   ├── context/         # React Context (Auth, etc.)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── pages/           # Screen components
│   │   ├── services/        # API service
│   │   └── App.tsx          # Main app component
│   ├── app.json             # Expo configuration
│   ├── app.config.js        # Expo config (JS)
│   ├── babel.config.js      # Babel configuration
│   ├── package.json
│   └── tsconfig.json
│
└── README.md
```

## 🔐 Authentication Flow

1. User registers/logs in
2. Backend returns JWT access token and refresh token
3. Tokens stored in AsyncStorage
4. Access token included in API requests
5. On 401 error, refresh token used to get new access token
6. On logout, tokens cleared from storage

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/verify-email` - Verify email address
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Workouts
- `GET /api/workouts/weekly` - Get weekly public workouts
- `GET /api/workouts/:id` - Get specific workout
- `POST /api/workouts` - Create workout (trainer only)

### Groups
- `GET /api/groups` - Get all public groups
- `POST /api/groups` - Create new group
- `POST /api/groups/:id/join` - Join a group

### Subscriptions
- `GET /api/subscriptions/current` - Get current subscription
- `POST /api/subscriptions/upgrade` - Upgrade to Active Client
- `POST /api/subscriptions/cancel` - Cancel subscription

### Schedule
- `GET /api/schedule/availability` - Get trainer availability (Active Client)
- `POST /api/schedule/book` - Book a session (Active Client)
- `GET /api/schedule/sessions` - Get user's sessions

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Testing
- Use Expo Go for quick testing on physical devices
- Use iOS Simulator or Android Emulator for development
- Test on multiple device sizes and orientations

## 🚢 Deployment

### Backend
- Deploy to platforms like Heroku, Railway, AWS, or DigitalOcean
- Set environment variables in your hosting platform
- Ensure MongoDB is accessible (MongoDB Atlas recommended)

### Frontend (Mobile App)
- Use Expo Application Services (EAS) for builds
- Submit to App Store (iOS) and Google Play Store (Android)
- Configure app store listings with screenshots and descriptions

## 📝 Development Status

### ✅ Completed
- User authentication system
- User model with comprehensive profile
- Workout model with exercise details
- Group model with social features
- Email service with templates
- Socket.io setup for real-time features
- React Native app structure
- Navigation setup
- API service with AsyncStorage

### 🚧 In Progress
- Route handler implementations
- Frontend screen components
- Stripe subscription integration
- Real-time messaging UI
- Workout execution interface

### 📋 TODO
- Complete all API route handlers
- Build all frontend screens
- Implement file uploads (Cloudinary)
- Add push notifications
- Create progress visualization
- Implement video call UI
- Add comprehensive error handling
- Write unit and integration tests

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

ISC License - see LICENSE file for details

## 👥 Author

KingVision Fitness

## 📞 Support

For support, email support@kingvisionfitness.com or create an issue in the repository.

---

**Note**: This is a mobile application. The frontend is built with React Native (Expo) and is designed to run on iOS and Android devices. The backend is a RESTful API that can be deployed independently.
