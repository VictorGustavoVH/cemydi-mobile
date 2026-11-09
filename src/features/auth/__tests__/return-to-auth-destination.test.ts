import type { ImperativeRouter } from 'expo-router';
import { cancelAuthFlow, returnToAuthDestination } from '../return-to-auth-destination';

function createRouter(canDismiss: boolean) {
  return {
    canDismiss: jest.fn(() => canDismiss),
    dismiss: jest.fn((_count?: number) => undefined),
    navigate: jest.fn(),
    dismissAll: jest.fn(),
    push: jest.fn((_href: string) => undefined),
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

describe('cancelAuthFlow', () => {
  it.each(['(tabs)', 'producto/[id]', 'carrito'])(
    'conserva %s como origen sin abrir el destino privado',
    (origin) => {
      const router = createRouter(true);
      cancelAuthFlow(router as unknown as ImperativeRouter, {
        index: 1,
        routes: [{ name: origin }, { name: 'login' }],
      });
      expect(router.dismiss).toHaveBeenCalledWith(1);
      expect(router.navigate).not.toHaveBeenCalled();
      expect(router.push).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
    },
  );
  it('cierra todos los formularios de acceso y conserva el producto', () => {
    const router = createRouter(true);
    cancelAuthFlow(router as unknown as ImperativeRouter, {
      index: 3,
      routes: [
        { name: 'producto/[id]' },
        { name: 'login' },
        { name: 'register' },
        { name: 'login' },
      ],
    });
    expect(router.dismiss).toHaveBeenCalledWith(3);
  });
  it('un login directo vuelve a Inicio', () => {
    const router = createRouter(false);
    cancelAuthFlow(router as unknown as ImperativeRouter);
    expect(router.replace).toHaveBeenCalledWith('/inicio');
  });
  it('una pila formada solo por formularios termina en Inicio', () => {
    const router = createRouter(true);
    cancelAuthFlow(router as unknown as ImperativeRouter, {
      index: 1,
      routes: [{ name: 'register' }, { name: 'login' }],
    });
    expect(router.dismissAll).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/inicio');
  });
});

it('elimina login, registro y OTP antes de escribir; Atrás conserva el producto de origen', () => {
  const stack = ['(tabs)', 'producto/[id]', 'login', 'register', 'otp', 'login'];
  const router = createRouter(true);
  router.dismiss.mockImplementation((count = 1) => {
    stack.splice(-count);
  });
  router.push.mockImplementation((href: string) => {
    stack.push(href);
  });
  returnToAuthDestination(router as unknown as ImperativeRouter, '/perfil/resenas/101', {
    index: stack.length - 1,
    routes: stack.map((name) => ({ name })),
  });
  expect(stack).toEqual(['(tabs)', 'producto/[id]', '/perfil/resenas/101']);
  stack.pop();
  expect(stack.at(-1)).toBe('producto/[id]');
  expect(router.dismiss).toHaveBeenCalledWith(4);
});

it('un acceso directo que solo contiene formularios no deja otro login debajo del destino', () => {
  const router = createRouter(true);
  returnToAuthDestination(router as unknown as ImperativeRouter, '/perfil/resenas/101', {
    index: 2,
    routes: [{ name: 'login' }, { name: 'register' }, { name: 'login' }],
  });
  expect(router.dismissAll).toHaveBeenCalledTimes(1);
  expect(router.replace).toHaveBeenCalledWith('/perfil/resenas/101');
  expect(router.push).not.toHaveBeenCalled();
});
