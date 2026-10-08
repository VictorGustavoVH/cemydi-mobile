import { useEffect } from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { render } from '../../../../tests/support/render-with-toast';
import { CatalogPreviewProvider, useCatalogPreview } from '@/providers/catalog-preview-provider';
import { CartPreviewScreen } from '../CartPreviewScreen';
import { useAuthPreview } from '@/providers/auth-preview-provider';
import * as CatalogImageModule from '@/components/ui/CatalogImage';

const mockRouter = { canGoBack: () => true, back: jest.fn(), push: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined) }));

function Seed({
  quantity = 1,
  oxygen = false,
  signedIn = false,
}: {
  quantity?: number;
  oxygen?: boolean;
  signedIn?: boolean;
}) {
  const { addItem, updateQuantity } = useCatalogPreview();
  const { setUser } = useAuthPreview();
  useEffect(() => {
    if (signedIn) setUser({ nombre: 'Cliente CEMYDI', correo: 'cliente@cemydi.test' });
    addItem('wheelchair', 'purchase');
    addItem('wheelchair', 'rental');
    if (quantity > 1) updateQuantity('wheelchair', 'purchase', quantity);
    if (oxygen) addItem('oxygen', 'rental');
    // Seed once; callbacks are session-provider operations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <CartPreviewScreen />;
}

describe('Carrito de muestra', () => {
  it('no renderiza la imagen de otra tarjeta al cambiar selección o cantidad', async () => {
    const image = jest.spyOn(CatalogImageModule, 'CatalogImage');
    const view = await render(
      <CatalogPreviewProvider>
        <Seed oxygen />
      </CatalogPreviewProvider>,
    );
    const item = await screen.findByLabelText('Ver Silla de ruedas, compra');
    await fireEvent(item, 'longPress');
    image.mockClear();
    await fireEvent.press(screen.getByLabelText('Seleccionar Silla de ruedas, compra'));
    expect(image.mock.calls.some(([props]) => props.label === 'Concentrador de oxígeno')).toBe(
      false,
    );
    image.mockClear();
    await fireEvent.press(screen.getByLabelText('Aumentar cantidad de Silla de ruedas, compra'));
    expect(image.mock.calls.some(([props]) => props.label === 'Concentrador de oxígeno')).toBe(
      false,
    );
    expect(screen.getByLabelText('Cantidad de Silla de ruedas, compra: 2')).toBeTruthy();
    await view.unmount();
  });
  it('actualiza cantidad, selección, resumen y contador sin mezclar modalidades', async () => {
    await render(
      <CatalogPreviewProvider>
        <Seed />
      </CatalogPreviewProvider>,
    );
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByText(/Carrito de muestra/)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Revisar carrito' })).toHaveLength(1);
    expect(screen.getAllByLabelText('Cupones · próximamente')).toHaveLength(1);
    await fireEvent.press(screen.getByLabelText('Aumentar cantidad de Silla de ruedas, compra'));
    expect(screen.getByLabelText('Cantidad de Silla de ruedas, compra: 2')).toBeTruthy();
    expect(screen.getByLabelText('Cantidad de Silla de ruedas, renta: 1')).toBeTruthy();
    expect(screen.getByLabelText('Subtotal de compra: $7,700.00 MXN')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Ver Silla de ruedas, compra'), 'longPress');
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Seleccionar Silla de ruedas, compra' }),
    );
    expect(screen.getByLabelText('Subtotal de compra: $0.00 MXN')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revisar carrito', disabled: false })).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Seleccionar Silla de ruedas, renta'));
    expect(screen.getByRole('button', { name: 'Revisar carrito', disabled: true })).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Seleccionar toda la sección Compra' }),
    );
    expect(screen.getByLabelText('Subtotal de compra: $7,700.00 MXN')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Listo'));
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText('2 de 3 unidades incluidas')).toBeTruthy();
  });

  it('respeta los límites de cantidad y restaura la modalidad eliminada', async () => {
    await render(
      <CatalogPreviewProvider>
        <Seed quantity={25} />
      </CatalogPreviewProvider>,
    );
    expect(
      screen.getByRole('button', {
        name: 'Aumentar cantidad de Silla de ruedas, compra',
        disabled: true,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Reducir cantidad de Silla de ruedas, renta',
        disabled: true,
      }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Eliminar Silla de ruedas, compra'));
    expect(screen.queryByLabelText('Cantidad de Silla de ruedas, compra: 25')).toBeNull();
    expect(await screen.findByText('Producto eliminado')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Deshacer eliminación del producto'));
    expect(await screen.findByText('Producto restaurado')).toBeTruthy();
    expect(await screen.findByLabelText('Cantidad de Silla de ruedas, compra: 25')).toBeTruthy();
  });

  it('valida fechas, guarda un borrador por equipo y conserva datos al editar o deshacer', async () => {
    await render(
      <CatalogPreviewProvider>
        <Seed oxygen />
      </CatalogPreviewProvider>,
    );
    await fireEvent.press(screen.getByLabelText('Configurar renta de Concentrador de oxígeno'));
    expect(screen.getByText('Receta requerida')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Fecha de inicio'), '31/02/2027');
    await fireEvent.changeText(screen.getByLabelText('Fecha de devolución'), '10/03/2027');
    await fireEvent.press(screen.getByLabelText('Guardar borrador'));
    expect(screen.getByText('Escribe una fecha válida: DD/MM/AAAA.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Fecha de inicio'), '01032027');
    await fireEvent.changeText(
      screen.getByLabelText('Notas de la renta (opcional)'),
      'Entrega por la mañana',
    );
    await fireEvent.press(screen.getByLabelText('Guardar borrador'));
    expect(screen.getByText('01/03/2027 al 10/03/2027 · Borrador · Requiere receta')).toBeTruthy();
    expect(screen.getByLabelText('Configurar renta de Silla de ruedas')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Eliminar Concentrador de oxígeno, renta'));
    await fireEvent.press(screen.getByLabelText('Deshacer eliminación del producto'));
    await fireEvent.press(screen.getByLabelText('Editar renta de Concentrador de oxígeno'));
    expect(screen.getByDisplayValue('Entrega por la mañana')).toBeTruthy();
    expect(screen.getByDisplayValue('01/03/2027')).toBeTruthy();
  });

  it('permite revisar solo lo seleccionado y comunica el límite de cupones', async () => {
    await render(
      <CatalogPreviewProvider>
        <Seed oxygen signedIn />
      </CatalogPreviewProvider>,
    );
    await fireEvent(screen.getByLabelText('Ver Concentrador de oxígeno, renta'), 'longPress');
    await fireEvent.press(screen.getByLabelText('Seleccionar Concentrador de oxígeno, renta'));
    await fireEvent.press(screen.getByLabelText('Listo'));
    await fireEvent.press(screen.getByLabelText('Revisar carrito'));
    expect(screen.getAllByText('Silla de ruedas · 1 unidad')).toHaveLength(2);
    expect(screen.queryByText('Concentrador de oxígeno · 1 unidad')).toBeNull();
    expect(screen.getByText(/Esta revisión no envía una solicitud/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Volver al carrito'));
    await fireEvent.press(screen.getByLabelText('Cupones · próximamente'));
    expect(screen.getByText(/no se aplica ningún descuento/)).toBeTruthy();
  });

  it('muestra carrito vacío sin badge y permite deshacer la última eliminación', async () => {
    await render(
      <CatalogPreviewProvider>
        <Seed />
      </CatalogPreviewProvider>,
    );
    await fireEvent.press(screen.getByLabelText('Eliminar Silla de ruedas, compra'));
    await fireEvent.press(screen.getByLabelText('Eliminar Silla de ruedas, renta'));
    expect(await screen.findByText('Tu carrito está vacío')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Deshacer eliminación del producto'));
    expect(await screen.findByLabelText('Cantidad de Silla de ruedas, renta: 1')).toBeTruthy();
  });
});
