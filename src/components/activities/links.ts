export const mapsUrl = (q: string): string =>
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

export const priceLabel = (cost: string): string => `£${cost.replace(/[^0-9.]/g, '') || cost} pp`;
