import { Alert } from 'react-native';
import { explainPermission } from '../permission-rationale';

it('solo continúa tras aceptación y permite cancelar o cerrar el diálogo', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  for (const action of ['accept', 'cancel', 'dismiss'] as const) {
    const result = explainPermission('microphone');
    const [, message, buttons, options] = alert.mock.calls.at(-1)!;
    expect(message).toContain('Puedes continuar buscando por escrito');
    if (action === 'dismiss') options?.onDismiss?.();
    else buttons?.[action === 'accept' ? 1 : 0].onPress?.();
    await expect(result).resolves.toBe(action === 'accept');
  }
  alert.mockRestore();
});
