const { createServer } = require('node:http');

// Public fixtures only: this runner never connects to a developer's backend.
const products = [1, 2].map((id) => ({
  id,
  slug: `equipo-e2e-${id}`,
  nombre: `Equipo E2E ${id}`,
  marca: 'CEMYDI E2E',
  modelo: `Modelo ${id}`,
  descripcion: 'Equipo de prueba para el catálogo público.',
  clasificacion: 'Movilidad',
  precio: 1200,
  stock: id === 1 ? 3 : 0,
  activo: true,
  tipoAdquisicion: 'MIXTO',
  requiereReceta: false,
  rentalDailyPrice: 60,
  rentalMinDays: 3,
  rentalDeposit: 300,
  rentalTerms: 'Condiciones de prueba.',
  medidas: null,
  pesoSoportado: null,
  material: null,
  contenidoCaja: null,
  indicacionesUso: null,
  imageUrl: null,
  images: [],
  createdAt: '2026-10-01T12:00:00.000Z',
}));

function createFixtureApi(onUnexpected = () => {}) {
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    const reject = (status = 400) => {
      onUnexpected({
        method: request.method,
        path: new URL(request.url, 'http://127.0.0.1').pathname,
        status,
      });
      send({ message: 'Petición no prevista en los escenarios E2E.' }, status);
    };
    const send = (body, status = 200) => {
      response.statusCode = status;
      response.end(JSON.stringify(body));
    };
    if (request.method !== 'GET' || request.headers.authorization || request.headers.cookie)
      return reject(405);
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/promotions' && !url.search) return send({ promotions: [] });
    if (url.pathname === '/products') {
      const allowed = new Set(['search', 'soloDisponibles', 'page', 'pageSize', 'sort']);
      if (
        [...url.searchParams.keys()].some((key) => !allowed.has(key)) ||
        (url.searchParams.has('soloDisponibles') &&
          url.searchParams.get('soloDisponibles') !== 'true') ||
        (url.searchParams.has('sort') && url.searchParams.get('sort') !== 'reciente') ||
        ['page', 'pageSize'].some(
          (key) => url.searchParams.has(key) && !/^[1-9]\d*$/.test(url.searchParams.get(key)),
        )
      )
        return reject();
      const search = (url.searchParams.get('search') || '').toLowerCase();
      const filtered = products.filter(
        (product) =>
          product.nombre.toLowerCase().includes(search) &&
          (url.searchParams.get('soloDisponibles') !== 'true' || product.stock > 0),
      );
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
      const pageSize = Math.max(1, Number(url.searchParams.get('pageSize')) || 24);
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      return send({
        products: filtered.slice((page - 1) * pageSize, page * pageSize),
        filters: { clasificaciones: ['Movilidad'], marcas: ['CEMYDI E2E'] },
        pagination: {
          page,
          pageSize,
          total: filtered.length,
          totalPages,
          hasPrevious: page > 1,
          hasNext: page < totalPages,
        },
      });
    }
    if (/^\/products\/[12]\/recommendations$/.test(url.pathname) && url.search === '?limit=5')
      return send({ recommendations: [] });
    if (/^\/reviews\/product\/[12]$/.test(url.pathname) && !url.search)
      return send({ reviews: [], summary: { count: 0, averageRating: 0 } });
    const id = url.pathname.match(/^\/products\/(\d+)$/)?.[1];
    const product = products.find((item) => item.id === Number(id));
    return product && !url.search ? send({ product }) : reject(404);
  });

  return server;
}

module.exports = { createFixtureApi };
