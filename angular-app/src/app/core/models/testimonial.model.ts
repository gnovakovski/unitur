export interface Testimonial {
  id: number;
  clientName: string;
  clientEmail?: string;
  clientPhoto?: string;
  tripId?: number;
  trip?: any;
  text: string;
  rating: number; // 1-5
  tripDate?: Date;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}
