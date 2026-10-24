import { safeProfileDestination } from '../auth-destination';

describe('destino tras iniciar sesión', () => {
  it('conserva rutas privadas internas permitidas y descarta enlaces externos o desconocidos', () => {
    expect(safeProfileDestination('/perfil/editar')).toBe('/perfil/editar');
    expect(safeProfileDestination('/perfil/cambiar-correo')).toBe('/perfil/cambiar-correo');
    expect(safeProfileDestination('https://evil.example/perfil')).toBe('/perfil');
    expect(safeProfileDestination('//evil.example')).toBe('/perfil');
    expect(safeProfileDestination('/perfil/unknown')).toBe('/perfil');
  });
});
