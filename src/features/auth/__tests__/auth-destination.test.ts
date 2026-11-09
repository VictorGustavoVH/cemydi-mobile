import { safeProfileDestination } from '../auth-destination';

describe('destino tras iniciar sesión', () => {
  it('conserva rutas privadas internas permitidas y descarta enlaces externos o desconocidos', () => {
    expect(safeProfileDestination('/perfil/resenas/101')).toBe('/perfil/resenas/101');
    expect(safeProfileDestination('/perfil/resenas/0')).toBe('/perfil');
    expect(safeProfileDestination('/perfil/resenas/1?evil=yes')).toBe('/perfil');
    expect(safeProfileDestination('/perfil/editar')).toBe('/perfil/editar');
    expect(safeProfileDestination('/perfil/cambiar-correo')).toBe('/perfil/cambiar-correo');
    expect(safeProfileDestination('/perfil/cambiar-contrasena')).toBe('/perfil/cambiar-contrasena');
    expect(safeProfileDestination('https://evil.example/perfil')).toBe('/perfil');
    expect(safeProfileDestination('//evil.example')).toBe('/perfil');
    expect(safeProfileDestination('/perfil/unknown')).toBe('/perfil');
  });
});
