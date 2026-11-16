import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setDoc } from 'firebase/firestore/lite';
import { TripService } from './trip.service';

vi.mock('firebase/firestore/lite', () => ({
  doc: vi.fn(() => 'trip-doc'), setDoc: vi.fn(),
  collection: vi.fn(), deleteDoc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(),
  limit: vi.fn(), query: vi.fn(), startAfter: vi.fn()
}));

describe('TripService persistência do PDF', () => {
  let service: TripService;
  const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setDoc).mockResolvedValue(undefined);
    service = new TripService({ firestore: {}, withTimeout: (promise: Promise<unknown>) => promise } as never, storage as never);
  });

  it('persiste URL e nome do PDF ao criar a viagem', async () => {
    const trip = await firstValueFrom(service.createTrip({ title: 'Viagem', categoryId: 0,
      itineraryPdfUrl: 'https://storage.example/roteiro.pdf', itineraryPdfName: 'Roteiro.pdf' }, true));
    expect(setDoc).toHaveBeenCalledWith('trip-doc', expect.objectContaining({
      itineraryPdfUrl: 'https://storage.example/roteiro.pdf', itineraryPdfName: 'Roteiro.pdf'
    }));
    expect(trip.itineraryPdfName).toBe('Roteiro.pdf');
  });

  it('permite remover o anexo gravando campos vazios na atualização', async () => {
    await firstValueFrom(service.updateTrip(123, { itineraryPdfUrl: '', itineraryPdfName: '' }, true));
    expect(setDoc).toHaveBeenCalledWith('trip-doc', expect.objectContaining({ itineraryPdfUrl: '', itineraryPdfName: '' }), { merge: true });
  });

  it('não confirma gravação só em cache quando o Firestore recusa o vínculo do PDF', async () => {
    vi.mocked(setDoc).mockRejectedValue(new Error('permission-denied'));
    await expect(firstValueFrom(service.updateTrip(123, { itineraryPdfUrl: 'https://storage.example/novo.pdf' }, true))).rejects.toThrow('permission-denied');
    await expect(firstValueFrom(service.createTrip({ title: 'Viagem' }, true))).rejects.toThrow('permission-denied');
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
