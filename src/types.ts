export interface ProductSearchResult {
  id: string;
  productCode: string;
  nameAr: string;
  priceSar: number;
  unitCode: string;
  unitAr: string;
  categoryAr: string | null;
  descriptionAr: string | null;
  allergensAr: string | null;
  pronunciationHint: string | null;
  availabilityStatus?: 'available' | 'unavailable' | 'unknown';
  availabilityNoteAr?: string | null;
}

export interface DraftItemInput {
  productCode: string;
  quantity: number;
  notesAr?: string;
}
