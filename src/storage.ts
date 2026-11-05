import { emptyData, validateData, type BudgetData } from './model';

interface Stored { data: BudgetData; revision: number }
let dbPromise: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('moa-budget-manager', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('budget');
      request.onerror = () => reject(new Error('기기 저장소를 열 수 없어요. 브라우저의 저장 권한을 확인해 주세요.'));
      request.onblocked = () => reject(new Error('다른 Budget Manager 창을 닫고 다시 열어 주세요.'));
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); dbPromise = undefined; };
        resolve(request.result);
      };
    }).catch(error => { dbPromise = undefined; throw error; });
  }
  return dbPromise;
}
export async function readData(): Promise<Stored> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('budget', 'readonly');
    const req = tx.objectStore('budget').get('current');
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => {
      try {
        if (!req.result) resolve({ data: emptyData(), revision: 0 });
        else resolve({ data: validateData(req.result.data), revision: req.result.revision });
      } catch (error) { reject(error); }
    };
    tx.onabort = () => reject(new Error('기기 기록을 읽지 못했어요.'));
  });
}
export async function writeData(data: BudgetData, expectedRevision: number): Promise<number> {
  const valid = validateData(data);
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('budget', 'readwrite');
    const store = tx.objectStore('budget');
    const req = store.get('current');
    let conflict = false;
    req.onsuccess = () => {
      const current = req.result?.revision ?? 0;
      if (current !== expectedRevision) { conflict = true; tx.abort(); return; }
      store.put({ data: valid, revision: current + 1 }, 'current');
    };
    tx.oncomplete = () => resolve(expectedRevision + 1);
    tx.onerror = () => reject(new Error('저장에 실패했어요. 기기의 저장 공간을 확인하고 다시 시도해 주세요.'));
    tx.onabort = () => reject(new Error(conflict ? '다른 창에서 기록이 변경됐어요. 새로고침한 뒤 다시 수정해 주세요.' : '저장이 완료되지 않았어요. 다시 시도해 주세요.'));
  });
}
