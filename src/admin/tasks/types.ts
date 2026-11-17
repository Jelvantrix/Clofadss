import type {
  Category,
  Collection,
  Customer,
  Discount,
  Order,
  Product,
  WaitlistEntry,
} from '../../types';

export type TaskFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'number'
  | 'money'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'record'
  | 'multirecord';

export interface TaskOption {
  value: string;
  label: string;
}

export interface TaskField {
  name: string;
  label: string;
  type: TaskFieldType;
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: TaskOption[];
  source?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: string | number | boolean | string[];
  wide?: boolean;
}

export interface TaskDefinition {
  id: string;
  title: string;
  description: string;
  group: string;
  system: string;
  action: string;
  fields: TaskField[];
  submitLabel?: string;
  success?: string;
  danger?: boolean;
  buildInput?: (input: Record<string, unknown>) => Record<string, unknown>;
}

export interface TaskData {
  products: Product[];
  orders: Order[];
  customers: Customer[];
  collections: Collection[];
  categories: Category[];
  discounts: Discount[];
  waitlist: WaitlistEntry[];
}

export type TaskValues = Record<string, string | boolean | string[]>;

export interface RecordOptions {
  bySource: Record<string, TaskOption[]>;
  loading: Record<string, boolean>;
  errors: Record<string, string>;
}
