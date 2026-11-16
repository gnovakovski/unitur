import { beforeEach, describe, expect, it, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { uploadBytes, getDownloadURL } from 'firebase/storage';
import { FirebaseService } from './firebase.service';
import { UploadService } from './upload.service';

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage, path) => path), uploadBytes: vi.fn(), getDownloadURL: vi.fn()
}));

describe('UploadService PDF', () => {
  let service: UploadService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new UploadService({ getStorage: async () => ({}) } as FirebaseService);
    vi.mocked(uploadBytes).mockResolvedValue({ ref: 'uploaded' } as never);
    vi.mocked(getDownloadURL).mockResolvedValue('https://storage.example/roteiro.pdf');
  });

  it('preserva os bytes do PDF e configura o download como anexo', async () => {
    const file = new File(['%PDF-1.7\nconteudo original'], 'Roteiro de viagem.pdf', { type: 'application/pdf' });
    const result = await firstValueFrom(service.uploadTripPdf(file, 123));
    expect(uploadBytes).toHaveBeenCalledWith(expect.stringMatching(/^viagens\/123\/.+\.pdf$/), file, expect.objectContaining({
      contentType: 'application/pdf', contentDisposition: expect.stringMatching(/^attachment; filename=".+\.pdf"$/)
    }));
    expect(result.url).toBe('https://storage.example/roteiro.pdf');
    expect(result.filename).toBe(file.name);
  });

  it('aceita PDF sem MIME informado pelo navegador e fixa o content-type correto', async () => {
    const file = new File(['%PDF-1.7'], 'roteiro.PDF');
    await firstValueFrom(service.uploadTripPdf(file, 123));
    expect(uploadBytes).toHaveBeenCalledWith(expect.anything(), file, expect.objectContaining({ contentType: 'application/pdf' }));
  });

  it('rejeita formatos diferentes e arquivos apenas renomeados para PDF', async () => {
    expect((await service.validatePdf(new File(['image'], 'foto.png', { type: 'image/png' }))).valid).toBe(false);
    await expect(firstValueFrom(service.uploadTripPdf(new File(['image'], 'falso.pdf', { type: 'application/pdf' }), 123))).rejects.toThrow('PDF válido');
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it('rejeita arquivos acima de 20 MB antes do upload', async () => {
    const file = new File(['%PDF-1.7'], 'roteiro.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 + 1 });
    expect((await service.validatePdf(file)).error).toContain('20 MB');
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it('propaga falha no Storage sem devolver uma URL de sucesso', async () => {
    vi.mocked(uploadBytes).mockRejectedValue(new Error('storage/unauthorized'));
    await expect(firstValueFrom(service.uploadTripPdf(new File(['%PDF-1.7'], 'roteiro.pdf'), 123))).rejects.toThrow('storage/unauthorized');
    expect(getDownloadURL).not.toHaveBeenCalled();
  });

  it('explica a recusa de permissão do PDF sem sugerir que um novo envio resolverá as regras', async () => {
    vi.mocked(uploadBytes).mockRejectedValue({ code: 'storage/unauthorized' });
    await expect(firstValueFrom(service.uploadTripPdf(new File(['%PDF-1.7'], 'roteiro.pdf'), 123))).rejects.toThrow('regras do Storage');
    expect(getDownloadURL).not.toHaveBeenCalled();
  });

  it('solicita novo login quando o Storage informa sessão não autenticada', async () => {
    vi.mocked(uploadBytes).mockRejectedValue({ code: 'storage/unauthenticated' });
    await expect(firstValueFrom(service.uploadTripPdf(new File(['%PDF-1.7'], 'roteiro.pdf'), 123))).rejects.toThrow('Entre novamente no painel');
  });
});
