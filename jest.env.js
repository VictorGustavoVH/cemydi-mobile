// Never load a developer's .env or point tests at a real backend.
process.env.EXPO_PUBLIC_APP_ENV = 'development';
process.env.EXPO_PUBLIC_API_URL = 'https://cemydi.test.invalid';
