import { FormBuilder } from '@angular/forms';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ViagemFormComponent } from './viagem-form.component';

describe('ViagemFormComponent anexo PDF', () => {
  afterEach(() => vi.restoreAllMocks());
  let component: ViagemFormComponent;
  const trips = { createTrip: vi.fn(), updateTrip: vi.fn() };
  const uploads = { validatePdf: vi.fn(), uploadTripPdf: vi.fn() };
  const router = { navigate: vi.fn() };
  const pdf = () => new File(['%PDF-1.7'], 'roteiro.pdf', { type: 'application/pdf' });
  beforeEach(() => {
    vi.clearAllMocks();
    trips.createTrip.mockReturnValue(of({ id: 123 }));
    trips.updateTrip.mockReturnValue(of({ id: 123 }));
    uploads.uploadTripPdf.mockReturnValue(of({ url: 'https://storage.example/novo.pdf', filename: 'roteiro.pdf' }));
    component = new ViagemFormComponent(new FormBuilder(), trips as never, uploads as never, {} as never,
      router as never, {} as never, { markForCheck: vi.fn() } as never, {} as never, {} as never);
    component.tripForm.patchValue({ title: 'Viagem teste', menuIds: ['curadoria'], country: 'Brasil', period: 'Novembro',
      startDate: '2026-11-22', price: 150, shortDescription: 'Chamada', description: 'Descrição' });
    component.selectedMenuIds.add('curadoria');
  });

  it('vincula o upload à viagem criada sem enviar File ao Firestore', async () => {
    const file = pdf();
    component.tripForm.patchValue({ itineraryPdf: file });
    await component.saveTrip();
    expect(trips.createTrip.mock.calls[0][0]).not.toHaveProperty('itineraryPdf');
    expect(uploads.uploadTripPdf).toHaveBeenCalledWith(file, 123);
    expect(trips.updateTrip).toHaveBeenCalledWith(123, {
      itineraryPdfUrl: 'https://storage.example/novo.pdf', itineraryPdfName: 'roteiro.pdf'
    }, true);
    expect(router.navigate).toHaveBeenCalledWith(['/admin/viagens']);
  });

  it('preserva o anexo existente ao editar outros campos', async () => {
    component.isEditMode = true;
    component.tripId = 123;
    component.tripForm.patchValue({ itineraryPdfUrl: 'https://storage.example/antigo.pdf', itineraryPdfName: 'antigo.pdf' });
    await component.saveTrip();
    expect(trips.updateTrip.mock.calls[0][1].itineraryPdfUrl).toBe('https://storage.example/antigo.pdf');
    expect(uploads.uploadTripPdf).not.toHaveBeenCalled();
  });

  it('remove o vínculo do PDF somente ao salvar', async () => {
    component.tripForm.patchValue({ itineraryPdfUrl: 'https://storage.example/antigo.pdf', itineraryPdfName: 'antigo.pdf' });
    component.removeItineraryPdf();
    expect(trips.updateTrip).not.toHaveBeenCalled();
    expect(component.tripForm.dirty).toBe(true);
    await component.saveTrip();
    expect(trips.createTrip.mock.calls[0][0]).toMatchObject({ itineraryPdfUrl: '', itineraryPdfName: '' });
  });

  it('mantém o PDF antigo quando a substituição falha e evita duplicar a viagem na nova tentativa', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    component.tripForm.patchValue({ itineraryPdf: pdf(), itineraryPdfUrl: 'https://storage.example/antigo.pdf', itineraryPdfName: 'antigo.pdf' });
    uploads.uploadTripPdf.mockReturnValueOnce(throwError(() => new Error('falha no upload')));
    await expect(component.saveTrip()).rejects.toThrow('falha no upload');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.tripForm.get('itineraryPdfUrl')?.value).toBe('https://storage.example/antigo.pdf');
    await component.saveTrip();
    expect(trips.createTrip).toHaveBeenCalledTimes(1);
    expect(trips.updateTrip).toHaveBeenCalledWith(123, expect.objectContaining({ itineraryPdfUrl: 'https://storage.example/antigo.pdf' }), true);
  });
});
