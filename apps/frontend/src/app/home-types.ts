export type Asset = {
  id: string;
  serialNumber: string;
  model: string;
  status: 'active' | 'inactive' | 'retired';
  customerId: string;
};
