import { FormBuilder } from '@angular/forms';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { PostFormComponent } from './post-form.component';

describe('PostFormComponent imagem de compartilhamento', () => {
  afterEach(() => vi.restoreAllMocks());
  let component: PostFormComponent;
  const posts = { createPost: vi.fn(), updatePost: vi.fn(), getPost: vi.fn() };
  const uploads = { uploadToEntity: vi.fn() };
  const router = { navigate: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    posts.createPost.mockReturnValue(of({ id: 456 }));
    posts.updatePost.mockReturnValue(of({ id: 456 }));
    uploads.uploadToEntity.mockReturnValue(of({ url: 'https://storage.example/compartilhamento.jpg' }));
    component = new PostFormComponent(new FormBuilder(), posts as never, {} as never, {} as never,
      uploads as never, router as never, {} as never, { markForCheck: vi.fn() } as never);
    component.postForm.patchValue({ title: 'Post teste', slug: 'post-teste', excerpt: 'Resumo do post',
      content: 'Conteúdo de um post de teste com detalhes de viagens e destinos turísticos.', categoryId: 1 });
  });

  it('envia o anexo para a pasta do post e persiste somente a URL', async () => {
    const file = new File(['imagem'], 'compartilhamento.jpg', { type: 'image/jpeg' });
    component.postForm.patchValue({ ogImage: file });
    await component.onSubmit();
    expect(posts.createPost.mock.calls[0][0].ogImage).toBe('');
    expect(uploads.uploadToEntity).toHaveBeenCalledWith(file, 'posts', 456);
    expect(posts.updatePost).toHaveBeenCalledWith(456, { ogImage: 'https://storage.example/compartilhamento.jpg' });
    expect(router.navigate).toHaveBeenCalledWith(['/admin/posts']);
  });

  it('conserva a URL já cadastrada sem reenviar a imagem', async () => {
    component.postForm.patchValue({ ogImage: 'https://storage.example/atual.jpg' });
    await component.onSubmit();
    expect(posts.createPost.mock.calls[0][0].ogImage).toBe('https://storage.example/atual.jpg');
    expect(uploads.uploadToEntity).not.toHaveBeenCalled();
  });

  it('grava vazio ao remover o anexo, mantendo a imagem destacada como alternativa', async () => {
    component.postForm.patchValue({ ogImage: null, featuredImage: 'https://storage.example/capa.jpg' });
    await component.onSubmit();
    expect(posts.createPost.mock.calls[0][0]).toMatchObject({ ogImage: '', featuredImage: 'https://storage.example/capa.jpg' });
  });

  it('preserva a imagem anterior se a substituição falhar e não duplica o post na nova tentativa', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    component.isEditMode = true;
    component.postId = 456;
    posts.getPost.mockReturnValue(of({ ...component.postForm.getRawValue(), id: 456, tags: [], relatedTrips: [],
      ogImage: 'https://storage.example/atual.jpg', author: { id: 1, name: 'Unitur' } }));
    component.loadPost(456);
    component.postForm.patchValue({ ogImage: new File(['imagem'], 'nova.jpg', { type: 'image/jpeg' }) });
    uploads.uploadToEntity.mockReturnValueOnce(throwError(() => new Error('Falha no Storage')));
    await expect(component.onSubmit()).rejects.toThrow('Falha no Storage');
    expect(posts.updatePost.mock.calls[0][1].ogImage).toBe('https://storage.example/atual.jpg');
    expect(router.navigate).not.toHaveBeenCalled();
    await component.onSubmit();
    expect(posts.createPost).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/admin/posts']);
  });
});
