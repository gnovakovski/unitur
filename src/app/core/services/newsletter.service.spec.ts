import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore/lite';
import { FirebaseService } from './firebase.service';
import { NewsletterService } from './newsletter.service';

vi.mock('firebase/firestore/lite', () => ({
  addDoc: vi.fn(), collection: vi.fn(() => 'subscribers'),
  serverTimestamp: vi.fn(() => 'server-time'), getDocs: vi.fn()
}));

describe('NewsletterService', () => {
  let service: NewsletterService;
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [
      NewsletterService,
      { provide: FirebaseService, useValue: { firestore: {}, withTimeout: (promise: Promise<unknown>) => promise } }
    ] });
    service = TestBed.inject(NewsletterService);
    vi.mocked(addDoc).mockResolvedValue({} as never);
  });

  it('normaliza os dados e registra consentimento com data do servidor', async () => {
    await service.subscribe('  Maria  ', '  MARIA@example.com  ');
    expect(collection).toHaveBeenCalledWith({}, 'newsletterSubscribers');
    expect(serverTimestamp).toHaveBeenCalled();
    expect(addDoc).toHaveBeenCalledWith('subscribers', {
      name: 'Maria', email: 'maria@example.com', consent: true, source: 'home', createdAt: 'server-time'
    });
  });

  it('recusa dados inválidos antes de escrever', async () => {
    await expect(service.subscribe('   ', 'maria@example.com')).rejects.toThrow();
    await expect(service.subscribe('Maria', 'invalido')).rejects.toThrow();
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('propaga falha de persistência sem simular cadastro bem-sucedido', async () => {
    vi.mocked(addDoc).mockRejectedValue(new Error('permission-denied'));
    await expect(service.subscribe('Maria', 'maria@example.com')).rejects.toThrow('permission-denied');
  });
});
