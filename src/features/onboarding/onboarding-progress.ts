import { File, Paths } from 'expo-file-system';

const ONBOARDING_PROGRESS_FILE = 'cemydi-onboarding-completed-v1';

function progressFile() {
  return new File(Paths.document, ONBOARDING_PROGRESS_FILE);
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  const file = progressFile();
  return file.exists && (await file.text()) === '1';
}

export async function completeOnboarding(): Promise<void> {
  const file = progressFile();
  if (!file.exists) file.create();
  file.write('1');
}
