export type Coordinates = { latitude: number; longitude: number };
export type MapBounds = {
  south: number;
  north: number;
  west: number;
  east: number;
};
export type MapPin = Coordinates & {
  id: string;
  label: string;
  count?: number;
};
export type MappedOpportunity = Coordinates & {
  id: string;
  business_id: string;
  title: string;
  company: string;
  address: string;
  employment_type: string;
  arrangement: string;
  location: string;
};
export const CANDELARIA_CENTER: Coordinates = {
  latitude: 13.931,
  longitude: 121.423,
};
