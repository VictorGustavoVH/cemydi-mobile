/** Medidas compartidas por la ficha conectada y su skeleton. */
export const PRODUCT_DETAIL_GALLERY_MAX_HEIGHT = 360;
export const PRODUCT_DETAIL_THUMBNAIL_SIZE = 64;
export const PRODUCT_DETAIL_THUMBNAIL_GAP = 10;

export const productDetailGalleryHeight = (width: number) =>
  Math.min(width, PRODUCT_DETAIL_GALLERY_MAX_HEIGHT);
