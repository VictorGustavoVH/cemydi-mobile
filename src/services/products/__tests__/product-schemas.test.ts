import { productFixture } from '../../../../tests/support/product-fixtures';
import { productSchema } from '../product-schemas';

describe('URLs de imágenes del contrato público', () => {
  it.each(['https://example.com/image.jpg', 'http://localhost:4000/image.jpg'])(
    'acepta URLs HTTP(S) absolutas: %s',
    (imageUrl) => {
      const product = productFixture(1);
      product.imageUrl = imageUrl;
      product.images[0]!.imageUrl = imageUrl;
      expect(productSchema.safeParse(product).success).toBe(true);
    },
  );
  it('conserva el contrato de producto sin imagen', () => {
    expect(productSchema.safeParse(productFixture(1, { imageUrl: null, images: [] })).success).toBe(
      true,
    );
  });
  it.each([
    '',
    'not a URL',
    '/image.jpg',
    '//example.com/image.jpg',
    'file:///private/image.jpg',
    'content://media/image',
    'data:image/png;base64,AAAA',
    'javascript:alert(1)',
    'ftp://example.com/image.jpg',
    'https:example.com/image.jpg',
    'https://user:pass@example.com/image.jpg',
  ])('rechaza %s tanto en imagen principal como en galería', (imageUrl) => {
    expect(productSchema.safeParse(productFixture(1, { imageUrl })).success).toBe(false);
    const product = productFixture(1);
    product.images[0]!.imageUrl = imageUrl;
    expect(productSchema.safeParse(product).success).toBe(false);
  });
});
