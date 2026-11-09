import { productShareUrl } from '../product-share';

it('construye enlaces de producto solo sobre el origen HTTPS confirmado', () => {
  expect(productShareUrl('silla-de-ruedas-42')).toBe(
    'https://ortopedia-cemydi.netlify.app/producto/silla-de-ruedas-42',
  );
});

it.each([
  '',
  '..',
  '../login',
  '//evil.example/producto/1',
  'https://ortopedia-cemydi.netlify.app.evil.example/producto/1',
  'https://evil.example/producto/1',
  'javascript:alert(1)',
  'silla?redirect=https://evil.example',
  'silla%2f..%2flogin',
])('rechaza URLs y rutas ajenas como slug: %s', (value) => {
  expect(productShareUrl(value)).toBeNull();
});
