const { createServer } = require('node:http');
const { Buffer } = require('node:buffer');

// Fixtures for E2E scenarios. Never connects to a real backend.
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
  proveedor: 'CEMYDI E2E',
  requiereReceta: true,
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

const DEFAULT_USER_A = {
  id: 10,
  nombre: 'Cliente CEMYDI',
  correo: 'cliente@cemydi.test',
  rol: 'CLIENT',
  activo: true,
  emailVerified: true,
  emailVerifiedAt: '2026-10-01T00:00:00.000Z',
  telefono: '5550001234',
  direccion: 'Calle E2E 123',
};

const DEFAULT_USER_B = {
  id: 20,
  nombre: 'Segundo Cliente E2E',
  correo: 'usuario2@cemydi.test',
  rol: 'CLIENT',
  activo: true,
  emailVerified: true,
  emailVerifiedAt: '2026-10-01T00:00:00.000Z',
  telefono: '5559876543',
  direccion: 'Avenida E2E 456',
};

const fixtureRental = {
  id: '501',
  folio: 'REN-2026-001',
  status: 'PENDING',
  createdAt: '2026-11-01T10:00:00.000Z',
  subtotal: 900,
  depositTotal: 300,
  total: 1200,
  rejectedReason: null,
  deliveryMethod: 'PICKUP',
  deliveryAddress: null,
  notes: 'Notas de renta de prueba',
  depositStatus: 'PENDING',
  depositReturnedAmount: 0,
  depositRetainedAmount: 0,
  statusHistory: [
    {
      id: 1,
      toStatus: 'PENDING',
      createdAt: '2026-11-01T10:00:00.000Z',
      note: 'Solicitud creada',
    },
  ],
  items: [
    {
      id: 1,
      productId: 1,
      quantity: 1,
      startDate: '2026-11-05T00:00:00.000Z',
      endDate: '2026-11-20T00:00:00.000Z',
      days: 15,
      lineTotal: 900,
      product: {
        id: 1,
        nombre: 'Equipo E2E 1',
        imageUrl: null,
      },
      prescription: null,
    },
  ],
};

function buildCartItem({ id = 101, productId = 1, mode = 'VENTA', quantity = 1 }) {
  const baseProduct = products.find((p) => p.id === productId) || products[0];
  const prod = {
    ...baseProduct,
    proveedor: 'CEMYDI E2E',
    imageUrl: null,
  };
  const lineTotal = mode === 'VENTA' ? prod.precio * quantity : null;
  return {
    id,
    mode,
    configurationStatus: 'COMPLETE',
    quantity,
    rentalStartDate: null,
    rentalEndDate: null,
    rentalDays: null,
    rentalNotes: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    lineTotal,
    promotion: null,
    rentalSummary: null,
    document: null,
    availability: {
      isAvailable: true,
      maxQuantity: prod.stock || 10,
      reason: null,
    },
    product: prod,
  };
}

function buildCart(items = []) {
  const saleItems = items.filter((it) => it.mode === 'VENTA');
  const rentalItems = items.filter((it) => it.mode === 'RENTA');
  const saleSubtotal = saleItems.reduce((acc, it) => acc + (it.lineTotal || 0), 0);
  const rentalSubtotal = rentalItems.reduce(
    (acc, it) => acc + (it.rentalSummary?.subtotal || 0),
    0,
  );
  const rentalDepositTotal = rentalItems.reduce(
    (acc, it) => acc + (it.rentalSummary?.depositTotal || 0),
    0,
  );
  const subtotal = saleSubtotal + rentalSubtotal;
  const total = subtotal + rentalDepositTotal;
  const totalQuantity = items.reduce((acc, it) => acc + it.quantity, 0);

  return {
    id: 'fixture-cart-id',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    appliedCoupon: null,
    items,
    summary: {
      distinctItems: items.length,
      totalQuantity,
      subtotal,
      saleSubtotal,
      rentalSubtotal,
      rentalDepositTotal,
      promotionDiscountTotal: 0,
      couponDiscountTotal: 0,
      discountTotal: 0,
      total,
      rentalItems: rentalItems.length,
      saleItems: saleItems.length,
      hasUnavailableItems: false,
      hasUnconfiguredRentalItems: false,
    },
  };
}

function createFixtureApi(onUnexpected = () => {}, onResponse = () => {}) {
  const refreshOwners = new Map();
  let rotation = 0;
  let userA = { ...DEFAULT_USER_A };
  let userB = { ...DEFAULT_USER_B };
  let preferences = {
    pushEnabled: true,
    system: true,
    offers: false,
    rentals: true,
  };
  let cartItems = [];
  let nextCartItemId = 101;

  const server = createServer((request, response) => {
    response.once('finish', () =>
      onResponse({
        method: request.method,
        path: new URL(request.url, 'http://127.0.0.1').pathname,
        status: response.statusCode,
      }),
    );
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');

    const send = (body, status = 200) => {
      response.statusCode = status;
      response.end(JSON.stringify(body));
    };

    const reject = (status = 400) => {
      onUnexpected({
        method: request.method,
        path: new URL(request.url, 'http://127.0.0.1').pathname,
        status,
      });
      send({ message: 'Petición no prevista en los escenarios E2E.' }, status);
    };

    const url = new URL(request.url, 'http://127.0.0.1');

    // Public catalog endpoints: reject unexpected headers or write methods
    if (
      url.pathname.startsWith('/products') ||
      url.pathname === '/promotions' ||
      url.pathname.startsWith('/reviews')
    ) {
      if (request.method !== 'GET' || request.headers.authorization || request.headers.cookie) {
        return reject(405);
      }
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
        ) {
          return reject();
        }
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
      if (/^\/products\/[12]\/recommendations$/.test(url.pathname) && url.search === '?limit=5') {
        return send({ recommendations: [] });
      }
      if (/^\/reviews\/product\/[12]$/.test(url.pathname)) {
        const result = { reviews: [], summary: { count: 0, averageRating: 0 } };
        if (!url.search) return send(result);
        if (
          [...url.searchParams.keys()].some((key) => !['page', 'pageSize'].includes(key)) ||
          !/^[1-9]\d*$/.test(url.searchParams.get('page') || '') ||
          !/^[1-9]\d*$/.test(url.searchParams.get('pageSize') || '') ||
          Number(url.searchParams.get('page')) > 1_000_000 ||
          Number(url.searchParams.get('pageSize')) > 50
        )
          return reject();
        const page = Number(url.searchParams.get('page'));
        return send({
          ...result,
          pagination: {
            page,
            pageSize: Number(url.searchParams.get('pageSize')),
            total: 0,
            totalPages: 1,
            hasPreviousPage: page > 1,
            hasNextPage: false,
          },
        });
      }
      const id = url.pathname.match(/^\/products\/(\d+)$/)?.[1];
      const product = products.find((item) => item.id === Number(id));
      return product && !url.search ? send({ product }) : reject(404);
    }

    // Collect body for write or POST/PATCH/PUT requests
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      let body = {};
      if (chunks.length > 0) {
        try {
          if (!request.headers['content-type']?.startsWith('multipart/form-data'))
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          return reject(400);
        }
      }

      const authHeader = request.headers.authorization || '';
      const isUserB = authHeader.includes('usuario2') || authHeader.includes('e2e-2');
      const currentUser = isUserB ? userB : userA;

      // Authenticated endpoints
      if (url.pathname === '/auth/mobile/login' && request.method === 'POST') {
        if (body.correo === 'cliente@cemydi.test' && body.password === 'FixturePassword1!') {
          refreshOwners.set('a'.repeat(64), 10);
          return send({
            user: userA,
            accessToken: 'fixture-access-token-e2e',
            refreshToken: 'a'.repeat(64),
            accessExpiresInMs: 900000,
            refreshExpiresInMs: 604800000,
          });
        }
        if (body.correo === 'usuario2@cemydi.test' && body.password === 'FixturePassword2!') {
          refreshOwners.set('b'.repeat(64), 20);
          return send({
            user: userB,
            accessToken: 'fixture-access-token-e2e-2',
            refreshToken: 'b'.repeat(64),
            accessExpiresInMs: 900000,
            refreshExpiresInMs: 604800000,
          });
        }
        return send({ message: 'Credenciales invalidas' }, 401);
      }

      if (url.pathname === '/auth/mobile/refresh' && request.method === 'POST') {
        const owner = refreshOwners.get(body.refreshToken);
        if (!owner) return send({ message: 'Sesión inválida' }, 401);
        refreshOwners.delete(body.refreshToken);
        const next = (++rotation).toString(16).padStart(64, '0');
        refreshOwners.set(next, owner);
        return send({
          user: owner === 20 ? userB : userA,
          accessToken: `fixture-access-token-e2e${owner === 20 ? '-2' : ''}-r${rotation}`,
          refreshToken: next,
          accessExpiresInMs: 900000,
          refreshExpiresInMs: 604800000,
        });
      }

      if (url.pathname === '/auth/mobile/logout' && request.method === 'POST') {
        refreshOwners.delete(body.refreshToken);
        return send({ message: 'Sesión cerrada correctamente' });
      }

      const prescriptionItem = url.pathname.match(/^\/rentals\/cart-items\/(\d+)\/prescription$/);
      if (prescriptionItem && request.method === 'POST') {
        const item = cartItems.find((entry) => entry.id === Number(prescriptionItem[1]));
        const raw = Buffer.concat(chunks);
        const image = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS0cAAAAASUVORK5CYII=',
          'base64',
        );
        if (
          !item ||
          (raw.toString('latin1').match(/filename="/g) ?? []).length !== 1 ||
          !raw.includes('filename="CEMYDI_SYNTHETIC_ONLY.png"') ||
          !raw.includes(image)
        )
          return reject(400);
        item.document = {
          id: '11111111-1111-4111-8111-111111111111',
          originalFilename: 'CEMYDI_SYNTHETIC_ONLY.png',
          mimeType: 'image/png',
          bytes: image.length,
          status: 'PENDIENTE',
          uploadedAt: new Date().toISOString(),
          associatedAt: null,
        };
        return send({ message: 'Receta adjuntada', document: item.document });
      }

      if (url.pathname === '/users/me') {
        if (request.method === 'GET') {
          return send({ user: currentUser });
        }
        if (request.method === 'PATCH') {
          if (body.nombre) currentUser.nombre = body.nombre.trim();
          if (body.telefono !== undefined) currentUser.telefono = body.telefono;
          if (body.direccion !== undefined) currentUser.direccion = body.direccion;
          return send({ message: 'Perfil actualizado correctamente', user: currentUser });
        }
      }

      if (url.pathname === '/auth/password-reset/request' && request.method === 'POST') {
        return send({
          message: 'Si el correo está registrado, recibirás un código',
          resendAt: new Date(Date.now() + 60000).toISOString(),
          expiresAt: new Date(Date.now() + 600000).toISOString(),
        });
      }

      if (url.pathname === '/auth/password-reset/verify-code' && request.method === 'POST') {
        if (body.codigo === '00000000' || body.codigo === '12345678') {
          return send({
            message: 'Código verificado correctamente',
            expiresAt: new Date(Date.now() + 300000).toISOString(),
          });
        }
        return send({ message: 'El código es inválido o expiró' }, 400);
      }

      if (url.pathname === '/auth/password-reset/confirm' && request.method === 'POST') {
        return send({ message: 'Contraseña actualizada correctamente' });
      }

      if (url.pathname === '/auth/register' && request.method === 'POST') {
        return send({ message: 'Si la solicitud es válida, recibirás instrucciones por correo.' });
      }

      if (url.pathname === '/auth/email-verification/confirm-code' && request.method === 'POST') {
        return send({ message: 'Código verificado correctamente' });
      }

      if (url.pathname === '/cart') {
        if (request.method === 'GET') {
          const c = buildCart(cartItems);
          return send({ ...c, cart: c });
        }
        if (request.method === 'DELETE') {
          cartItems = [];
          const c = buildCart(cartItems);
          return send({ ...c, cart: c });
        }
      }

      if (url.pathname === '/cart/items' && request.method === 'POST') {
        const productId = body.productId || 1;
        const mode = body.mode || 'VENTA';
        const quantity = body.quantity || 1;
        const existing = cartItems.find((it) => it.product.id === productId && it.mode === mode);
        if (existing) {
          existing.quantity += quantity;
          if (existing.mode === 'VENTA') {
            existing.lineTotal = existing.product.precio * existing.quantity;
          }
        } else {
          cartItems.push(
            buildCartItem({
              id: nextCartItemId++,
              productId,
              mode,
              quantity,
            }),
          );
        }
        return send({ cart: buildCart(cartItems) });
      }

      if (url.pathname.startsWith('/cart/items/') && request.method === 'PATCH') {
        const itemId = Number(url.pathname.split('/').pop());
        const item = cartItems.find((it) => it.id === itemId);
        if (item && body.quantity) {
          item.quantity = body.quantity;
          if (item.mode === 'VENTA') {
            item.lineTotal = item.product.precio * item.quantity;
          }
        }
        return send({ cart: buildCart(cartItems) });
      }

      if (url.pathname.startsWith('/cart/items/') && request.method === 'DELETE') {
        const itemId = Number(url.pathname.split('/').pop());
        cartItems = cartItems.filter((it) => it.id !== itemId);
        return send({ cart: buildCart(cartItems) });
      }

      if (url.pathname === '/cart/rentals' && request.method === 'DELETE') {
        cartItems = cartItems.filter((it) => it.mode !== 'RENTA');
        return send({ cart: buildCart(cartItems) });
      }

      if (url.pathname === '/cart/coupon') {
        return send({ cart: buildCart(cartItems) });
      }

      if (url.pathname === '/rentals/mine' || url.pathname === '/rentals') {
        if (request.method === 'GET') {
          return send({
            rentals: [fixtureRental],
            pagination: {
              page: 1,
              pageSize: 8,
              total: 1,
              totalPages: 1,
            },
          });
        }
      }

      if (url.pathname.startsWith('/rentals/mine/')) {
        if (request.method === 'GET') {
          const id = decodeURIComponent(url.pathname.split('/').pop());
          return send({ rental: { ...fixtureRental, id } });
        }
      }

      if (url.pathname === '/rentals/from-cart' && request.method === 'POST') {
        return send({ message: 'Solicitud creada con éxito', rental: fixtureRental }, 201);
      }

      if (
        url.pathname.startsWith('/rentals/') &&
        url.pathname.endsWith('/cancel') &&
        request.method === 'PATCH'
      ) {
        const parts = url.pathname.split('/');
        const id = decodeURIComponent(parts[parts.length - 2]);
        return send({
          message: 'Solicitud cancelada',
          rental: { ...fixtureRental, id, status: 'CANCELLED' },
        });
      }

      if (url.pathname === '/notifications/preferences') {
        if (request.method === 'GET') {
          return send({ preferences });
        }
        if (request.method === 'PATCH') {
          preferences = { ...preferences, ...body };
          return send({ preferences });
        }
      }

      if (url.pathname === '/notifications/subscriptions/register' && request.method === 'POST') {
        return send({ id: 'fixture-sub-id' });
      }

      if (url.pathname === '/notifications/subscriptions/unregister' && request.method === 'POST') {
        return send({ message: 'ok' });
      }

      if (url.pathname === '/notifications' && request.method === 'GET') {
        return send({ items: [], unreadCount: 0, total: 0, page: 1, pageSize: 20 });
      }

      if (url.pathname === '/favorites' && request.method === 'GET') {
        return send({ items: [], total: 0 });
      }

      if (url.pathname === '/favorites/ids' && request.method === 'GET') {
        return send({ ids: [] });
      }

      if (url.pathname === '/account-deletion/me' && request.method === 'GET') {
        return send({ request: null, pendingObligations: 0 });
      }

      if (url.pathname === '/account-deletion/request' && request.method === 'POST') {
        return send({
          message: 'Enviado',
          resendAt: new Date(Date.now() + 60000).toISOString(),
          expiresAt: new Date(Date.now() + 600000).toISOString(),
        });
      }

      if (url.pathname === '/account-deletion/confirm' && request.method === 'POST') {
        return send({
          id: 'fixture-deletion-id',
          status: 'PROCESSING',
          message: 'La eliminación está en proceso.',
        });
      }

      return reject(405);
    });
  });

  return server;
}

module.exports = { createFixtureApi };
