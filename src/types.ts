export type ModuleType = 'inventory' | 'documents' | 'groceries' | 'digital' | 'expenses';

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  module: ModuleType;
  icon?: string;
  custom_fields?: string; // JSON string
}

export interface Item {
  id: string;
  category_id: string;
  name: string;
  brand?: string;
  purchase_date?: string;
  price?: number;
  location_id?: string;
  notes?: string;
  metadata?: string; // JSON string
}

export interface Location {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface Expense {
  id: string;
  category_id: string;
  amount: number;
  date: string;
  payment_method?: string;
  vendor?: string;
  notes?: string;
}
