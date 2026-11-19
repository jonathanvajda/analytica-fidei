import { IDBFactory } from 'fake-indexeddb';
import { openAnalysisRepository } from '../docs/js/adapters/project-storage.js';
import { createAnalysisProject } from '../docs/js/core/project.js';
import { createPracticePassage } from '../docs/js/core/practice-passages.js';

test('projects survive closing and reopening an IndexedDB connection', async () => {
  const indexedDBRef = new IDBFactory();
  let repository = await openAnalysisRepository({ indexedDBRef });
  const project = createAnalysisProject({ id: 'one', name: 'Persisted', passage: createPracticePassage('hbo') });
  await repository.save(project);
  repository.close();
  repository = await openAnalysisRepository({ indexedDBRef });
  expect(await repository.get('one')).toEqual(project);
  expect(await repository.list()).toHaveLength(1);
  await repository.delete('one');
  expect(await repository.get('one')).toBeNull();
  repository.close();
});

test('invalid documents cannot overwrite a valid saved project', async () => {
  const repository = await openAnalysisRepository({ indexedDBRef: new IDBFactory() });
  const project = createAnalysisProject({ id: 'one', name: 'Original', passage: createPracticePassage() });
  await repository.save(project);
  await expect(repository.save({ ...project, schemaVersion: 0 })).rejects.toThrow();
  expect((await repository.get('one')).name).toBe('Original');
  repository.close();
});

test('unavailable IndexedDB rejects explicitly', async () => {
  await expect(openAnalysisRepository({ indexedDBRef: null })).rejects.toThrow(/not available/);
});
