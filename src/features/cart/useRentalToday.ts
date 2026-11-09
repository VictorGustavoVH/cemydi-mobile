import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { rentalToday } from './rental-dates';

export function useRentalToday() {
  const [today, setToday] = useState(() => rentalToday());
  useEffect(() => {
    const update = () => setToday(rentalToday());
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    const timer = setInterval(update, 60_000);
    return () => {
      listener.remove();
      clearInterval(timer);
    };
  }, []);
  return today;
}
