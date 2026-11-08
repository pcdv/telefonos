// @ts-check
/**
 * Where the private keys of the admins are kept: IndexedDB, which stores a key that cannot be
 * extracted as such, so that the page can sign with it but not read it. Clearing the site data loses
 * them, and the pairing then has no admin left: a new one is needed.
 *
 * Where IndexedDB is not available (a private window), nothing is kept and nobody is admin.
 */

const STORE = 'keys';

/** @returns {Promise<IDBDatabase>} */
function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('telefonos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * @template T
 * @param {'readonly' | 'readwrite'} mode
 * @param {(store: IDBObjectStore) => IDBRequest<T>} action
 * @returns {Promise<T>}
 */
async function run(mode, action) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  finally {
    db.close();
  }
}

/**
 * @param {string} publicKey which pairing's admin it is: its public key
 * @param {CryptoKey} privateKey
 * @returns {Promise<boolean>} whether it was kept
 */
export async function saveKey(publicKey, privateKey) {
  try {
    await run('readwrite', store => store.put(privateKey, publicKey));
    return true;
  }
  catch (e) {
    return false;
  }
}

/**
 * @param {string} publicKey
 * @returns {Promise<CryptoKey | null>} the private key, if this device is the admin
 */
export async function loadKey(publicKey) {
  try {
    return (await run('readonly', store => store.get(publicKey))) || null;
  }
  catch (e) {
    return null;
  }
}

/** @param {string} publicKey */
export async function deleteKey(publicKey) {
  try {
    await run('readwrite', store => store.delete(publicKey));
  }
  catch (e) {
    // nothing was kept
  }
}
