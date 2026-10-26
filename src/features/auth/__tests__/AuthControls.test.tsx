import { useState } from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { render } from '../../../../tests/support/render-with-toast';
import { PasswordField } from '@/components/ui/PasswordField';
import { AppInput } from '@/components/ui/AppInput';
import { colors } from '@/theme';
import { PasswordStrength } from '../components/PasswordStrength';
import { OtpInput } from '../components/OtpInput';

describe('Controles de formularios', () => {
  it('abre los requisitos desde el icono del label y mantiene independiente el ojo', async () => {
    await render(<PasswordField label="Contraseña" value="Password12!" valid />);
    expect(screen.queryByText(/Usa entre 10 y 72/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Requisitos de contraseña'));
    expect(screen.getByText(/Usa entre 10 y 72/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Cerrar requisitos'));
    expect(screen.getByLabelText('Contraseña')).toHaveProp('secureTextEntry', true);
    await fireEvent.press(screen.getByLabelText('Mostrar contraseña'));
    expect(screen.getByLabelText('Contraseña')).toHaveProp('secureTextEntry', false);
    expect(screen.queryByText(/Usa entre 10 y 72/)).toBeNull();
  });

  it('indica formato válido sin ocultar errores y cambia el color de cada nivel', async () => {
    const view = await render(<AppInput label="Correo" valid />);
    expect(screen.getByLabelText('Correo')).toHaveStyle({ borderColor: colors.brand });
    expect(screen.getByLabelText('Correo')).toHaveProp('accessibilityHint', 'Formato válido');
    await view.rerender(<AppInput label="Correo" valid error="Revisa el correo" />);
    expect(screen.getByLabelText('Correo')).toHaveStyle({
      borderColor: colors.inputError,
      borderWidth: 2,
    });
    expect(screen.getByLabelText('Correo')).toHaveProp('aria-invalid', true);
    for (const [password, score] of [
      ['A', 1],
      ['A1', 2],
      ['A1!', 3],
      ['Password12!', 4],
    ] as const) {
      await view.rerender(<PasswordStrength password={password} />);
      expect(screen.getByRole('progressbar')).toHaveProp(
        'accessibilityValue',
        expect.objectContaining({ now: score }),
      );
    }
  });

  it('normaliza el pegado, mueve foco lógico y evita estilos nativos sobre las casillas', async () => {
    function Field() {
      const [value, setValue] = useState('');
      return <OtpInput value={value} onChange={setValue} />;
    }
    const view = await render(<Field />);
    const input = screen.getByLabelText('Código de verificación de 8 dígitos');
    await fireEvent(input, 'focus', { target: 1 });
    expect(screen.getByTestId('otp-cell-0', { includeHiddenElements: true })).toHaveStyle({
      borderColor: colors.focus,
    });
    await fireEvent.changeText(input, '0000 0000');
    expect(input).toHaveProp('value', '00000000');
    expect(input).toHaveStyle({ color: 'transparent', borderWidth: 0 });
    expect(input).not.toHaveStyle({ opacity: 0 });
    expect(input.props.className ?? '').not.toContain('text-primary');
    expect(screen.getAllByText('0', { includeHiddenElements: true })).toHaveLength(8);
    await fireEvent(input, 'selectionChange', { nativeEvent: { selection: { start: 3, end: 3 } } });
    expect(screen.getByTestId('otp-cell-3', { includeHiddenElements: true })).toHaveStyle({
      borderColor: colors.focus,
    });
    await fireEvent.changeText(input, '0001234 567800000');
    expect(input).toHaveProp('value', '12345678');
    await fireEvent(input, 'blur', { target: 1 });
    expect(screen.getByTestId('otp-cell-3', { includeHiddenElements: true })).toHaveStyle({
      borderColor: colors.border,
    });
    await view.rerender(<OtpInput value="00000000" onChange={jest.fn()} verified />);
    for (let index = 0; index < 8; index++) {
      expect(screen.getByTestId(`otp-cell-${index}`, { includeHiddenElements: true })).toHaveStyle({
        borderColor: colors.success,
        backgroundColor: colors.successMuted,
        minWidth: 0,
      });
    }
    expect(screen.getByLabelText('Código de verificación de 8 dígitos')).toHaveProp(
      'editable',
      false,
    );
  });
});
