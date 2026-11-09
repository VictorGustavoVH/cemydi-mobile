import { render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { RentalSuccessCheckmark } from '../components/RentalSuccessCheckmark';

jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success' },
  notificationAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('RentalSuccessCheckmark', () => {
  it('renderiza la insignia animada y dispara feedback háptico de éxito al mostrarse', async () => {
    const withSpringSpy = jest.spyOn(Reanimated, 'withSpring');
    const withTimingSpy = jest.spyOn(Reanimated, 'withTiming');

    const view = await render(<RentalSuccessCheckmark />);

    expect(screen.getByTestId('rental-success-checkmark')).toBeTruthy();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
    expect(withSpringSpy).toHaveBeenCalled();
    expect(withTimingSpy).toHaveBeenCalled();

    await view.unmount();
    expect(Reanimated.cancelAnimation).toHaveBeenCalled();
  });

  it('respeta movimiento reducido mostrando el estado final sin animaciones de escala o trazo', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const withSpringSpy = jest.spyOn(Reanimated, 'withSpring');

    await render(<RentalSuccessCheckmark />);

    expect(screen.getByTestId('rental-success-checkmark')).toBeTruthy();
    expect(withSpringSpy).not.toHaveBeenCalled();
  });
});
