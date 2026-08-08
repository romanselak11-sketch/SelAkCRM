type UserRole = 'SUPER_ADMIN' | 'SUPER_MANAGER' | 'MANAGER';

export type Me = {
  id: string;
  login: string;
  role: UserRole;
  theme: 'light' | 'dark';
  permissions: string[];
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type ClientListItem = {
  id: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  phone: string;
  additionalPhones?: { id: string; phone: string }[];
  email?: string | null;
  documentsUrl?: string | null;
};
