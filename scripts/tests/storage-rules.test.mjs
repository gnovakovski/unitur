import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectStorageEmulator, getStorage, ref, uploadBytes, getMetadata, listAll } from 'firebase/storage';

// Este teste só executa com os dois emuladores, em projeto demonstrativo.
const projectId = 'demo-unitur-storage';
const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
assert.ok(storageHost?.startsWith('127.0.0.1:'), 'Inicie o emulador de Storage local.');
assert.ok(firestoreHost?.startsWith('127.0.0.1:'), 'Inicie o emulador de Firestore local.');
const apps = [];
function storageFor(uid) {
  const app = initializeApp({ projectId, apiKey: 'emulator-only', storageBucket: `${projectId}.appspot.com` }, `rules-${uid || 'anonymous'}-${apps.length}`);
  apps.push(app);
  const storage = getStorage(app);
  const [host, port] = storageHost.split(':');
  connectStorageEmulator(storage, host, Number(port), uid ? { mockUserToken: { sub: uid, user_id: uid } } : {});
  return storage;
}
async function seedUser(uid, status) {
  const response = await fetch(`http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { status: { stringValue: status } } })
  });
  assert.equal(response.status, 200);
}
const pdf = new TextEncoder().encode('%PDF-1.7\nmodelo de teste');
let staff;
before(async () => {
  await seedUser('staff-active', 'active');
  await seedUser('staff-inactive', 'inactive');
  staff = storageFor('staff-active');
});
after(async () => { await Promise.all(apps.map(deleteApp)); });

test('perfil ativo pode criar e substituir PDF do roteiro', async () => {
  const target = ref(staff, 'viagens/123/roteiro.pdf');
  await uploadBytes(target, pdf, { contentType: 'application/pdf' });
  await uploadBytes(target, pdf, { contentType: 'application/pdf' });
  const metadata = await getMetadata(target);
  assert.equal(metadata.contentType, 'application/pdf');
});

test('visitante pode baixar o PDF, mas não pode enviar ou listar arquivos', async () => {
  const anonymous = storageFor();
  assert.equal((await getMetadata(ref(anonymous, 'viagens/123/roteiro.pdf'))).contentType, 'application/pdf');
  await assert.rejects(uploadBytes(ref(anonymous, 'viagens/123/anon.pdf'), pdf, { contentType: 'application/pdf' }), { code: 'storage/unauthorized' });
  await assert.rejects(listAll(ref(anonymous, 'viagens/123')), { code: 'storage/unauthorized' });
});

test('conta autenticada sem perfil de equipe não pode enviar PDF', async () => {
  await assert.rejects(uploadBytes(ref(storageFor('no-profile'), 'viagens/123/no-profile.pdf'), pdf, { contentType: 'application/pdf' }), { code: 'storage/unauthorized' });
});

test('perfil inativo não pode enviar PDF', async () => {
  await assert.rejects(uploadBytes(ref(storageFor('staff-inactive'), 'viagens/123/inactive.pdf'), pdf, { contentType: 'application/pdf' }), { code: 'storage/unauthorized' });
});

test('PDF fora da pasta numérica de roteiros continua bloqueado', async () => {
  for (const path of ['posts/123/roteiro.pdf', 'uploads/roteiro.pdf', 'viagens/tmp/roteiro.pdf']) {
    await assert.rejects(uploadBytes(ref(staff, path), pdf, { contentType: 'application/pdf' }), { code: 'storage/unauthorized' });
  }
});

test('tipo e extensão diferentes continuam bloqueados', async () => {
  await assert.rejects(uploadBytes(ref(staff, 'viagens/123/roteiro.pdf'), pdf, { contentType: 'application/octet-stream' }), { code: 'storage/unauthorized' });
  await assert.rejects(uploadBytes(ref(staff, 'viagens/123/roteiro.txt'), pdf, { contentType: 'application/pdf' }), { code: 'storage/unauthorized' });
});

test('mantém upload de imagens para equipe ativa', async () => {
  await uploadBytes(ref(staff, 'banners/123/banner.png'), new Uint8Array([137, 80, 78, 71]), { contentType: 'image/png' });
});

test('aceita PDF de 20 MB e recusa acima do limite', async () => {
  await uploadBytes(ref(staff, 'viagens/123/limit.pdf'), new Uint8Array(20 * 1024 * 1024), { contentType: 'application/pdf' });
  await assert.rejects(uploadBytes(ref(staff, 'viagens/123/too-large.pdf'), new Uint8Array(20 * 1024 * 1024 + 1), { contentType: 'application/pdf' }), { code: 'storage/unauthorized' });
});
