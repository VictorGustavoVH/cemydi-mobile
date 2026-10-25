import type { ImperativeRouter } from 'expo-router';
import { returnToAuthDestination } from '../return-to-auth-destination';

function createRouter(canDismiss: boolean) {
  return {
    canDismiss: jest.fn(() => canDismiss),
    dismiss: jest.fn(),
    navigate: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  };
}

describe('returnToAuthDestination', () => {
  it('sin stack reemplaza login por el destino', () => {
    const router = createRouter(false);

    returnToAuthDestination(router as unknown as ImperativeRouter, '/inicio');

    expect(router.replace).toHaveBeenCalledWith('/inicio');
    expect(router.dismiss).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('con stack y destino de pestaña cierra login y navega a la pestaña', () => {
    const router = createRouter(true);

    returnToAuthDestination(router as unknown as ImperativeRouter, '/perfil');

    expect(router.dismiss).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith('/perfil');
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('con stack y destino de perfil apila la subruta después de cerrar login', () => {
    const router = createRouter(true);

    returnToAuthDestination(router as unknown as ImperativeRouter, '/perfil/editar');

    expect(router.dismiss).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/perfil/editar');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
