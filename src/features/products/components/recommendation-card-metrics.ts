/** Ancho compartido por las tarjetas de recomendación y su skeleton. */
export const RECOMMENDATION_CARD_WIDTH = {
  compact: 210,
  regular: 170,
} as const;

export const recommendationCardWidth = (compact: boolean) =>
  compact ? RECOMMENDATION_CARD_WIDTH.compact : RECOMMENDATION_CARD_WIDTH.regular;
