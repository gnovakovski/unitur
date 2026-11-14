import { Injectable, inject } from '@angular/core';
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore/lite';
import { FirebaseService } from './firebase.service';

export interface NewsletterSubscriber {
  id: string;
  name: string;
  email: string;
  createdAt?: Date;
}

@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private readonly firebase = inject(FirebaseService);

  async subscribe(name: string, email: string): Promise<void> {
    name = name.trim();
    email = email.trim().toLowerCase();
    if (!name || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Confira seu nome e e-mail.');
    }
    // Não mantém contatos em localStorage nem confirma sucesso sem persistência.
    await this.firebase.withTimeout(addDoc(collection(this.firebase.firestore, 'newsletterSubscribers'), {
      name, email, consent: true, source: 'home', createdAt: serverTimestamp()
    }), 'Não foi possível concluir o cadastro.');
  }

  async getSubscribers(): Promise<NewsletterSubscriber[]> {
    const snapshot = await this.firebase.withTimeout(
      getDocs(collection(this.firebase.firestore, 'newsletterSubscribers')),
      'Não foi possível carregar os inscritos.'
    );
    return snapshot.docs.map(doc => ({
      ...this.firebase.normalizeDates(doc.data()), id: doc.id
    }) as NewsletterSubscriber).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }
}
