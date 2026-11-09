import { render, screen, fireEvent } from '@testing-library/react-native';
import { AppInput } from '../AppInput';
import { colors } from '@/theme';

describe('Estados y tamaños globales de AppInput', () => {
  it('marca contenido precargado, vuelve al estado vacío al borrar y no valida espacios', async () => {
    const view = await render(<AppInput label="Notas" value="Dato guardado" />);
    expect(screen.getByLabelText('Notas')).toHaveStyle({ borderColor: colors.brand });
    expect(screen.getByLabelText('Notas')).toHaveProp('accessibilityHint', 'Campo completado');
    await view.rerender(<AppInput label="Notas" value="   " />);
    expect(screen.getByLabelText('Notas')).not.toHaveStyle({ borderColor: colors.brand });
    await view.rerender(<AppInput label="Notas" value="" />);
    expect(screen.getByLabelText('Notas')).not.toHaveStyle({ borderColor: colors.brand });
  });
  it('respeta el resultado de validación y da prioridad al error sin cambiar el grosor', async () => {
    const view = await render(<AppInput label="Correo" value="incompleto" valid={false} />);
    expect(screen.getByLabelText('Correo')).not.toHaveStyle({ borderColor: colors.brand });
    await view.rerender(<AppInput label="Correo" value="cliente@example.invalid" valid />);
    expect(screen.getByLabelText('Correo')).toHaveStyle({
      borderWidth: 1,
      borderColor: colors.brand,
    });
    expect(screen.getByLabelText('Correo')).toHaveProp('accessibilityHint', 'Formato válido');
    await view.rerender(
      <AppInput label="Correo" value="cliente@example.invalid" valid error="Revisa el correo" />,
    );
    expect(screen.getByLabelText('Correo')).toHaveStyle({
      borderWidth: 1,
      borderColor: colors.inputError,
    });
    expect(screen.getByLabelText('Correo')).toHaveProp('aria-invalid', true);
  });
  it('actualiza campos no controlados y comunica los cambios al formulario', async () => {
    const change = jest.fn();
    await render(<AppInput label="Buscar" defaultValue="" onChangeText={change} />);
    await fireEvent.changeText(screen.getByLabelText('Buscar'), 'Equipo');
    expect(change).toHaveBeenCalledWith('Equipo');
    expect(screen.getByLabelText('Buscar')).toHaveStyle({ borderColor: colors.brand });
    await fireEvent.changeText(screen.getByLabelText('Buscar'), '');
    expect(screen.getByLabelText('Buscar')).not.toHaveStyle({ borderColor: colors.brand });
  });
  it('contiene textos extremos y mantiene scroll interno y altura acotada en notas', async () => {
    const long = 'Texto largo sin separaciones'.repeat(1000);
    const view = await render(<AppInput label="Dirección" value={long} />);
    expect(screen.getByLabelText('Dirección')).toHaveProp('value', long);
    expect(screen.getByLabelText('Dirección')).toHaveStyle({
      minWidth: 0,
      width: '100%',
      flexShrink: 1,
    });
    await view.rerender(<AppInput label="Dirección" value={long + '\n'.repeat(1000)} multiline />);
    expect(screen.getByLabelText('Dirección')).toHaveStyle({
      height: 120,
      maxHeight: 160,
      textAlignVertical: 'top',
    });
    expect(screen.getByLabelText('Dirección')).toHaveProp('scrollEnabled', true);
  });
  it('conserva los estilos explícitos del OTP sin aplicar el borde de completado', async () => {
    await render(
      <AppInput
        label="Código"
        unstyled
        value="12345678"
        style={{ height: 48, width: '100%', borderWidth: 0, color: 'transparent' }}
      />,
    );
    expect(screen.getByLabelText('Código')).toHaveStyle({
      height: 48,
      borderWidth: 0,
      color: 'transparent',
    });
    expect(screen.getByLabelText('Código')).not.toHaveStyle({ borderColor: colors.brand });
  });
});
