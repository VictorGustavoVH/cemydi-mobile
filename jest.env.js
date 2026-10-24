// Never load a developer's .env or point tests at a real backend.
process.env.TEST_AUTH_PREVIEW_PASSWORD = 'FixturePassword1!';
process.env.TEST_AUTH_PREVIEW_OTP = '00000000';
process.env.EXPO_PUBLIC_APP_ENV = 'development';
process.env.EXPO_PUBLIC_API_URL = 'https://cemydi.test.invalid';
