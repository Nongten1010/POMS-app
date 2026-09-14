import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { mkdtemp, readFile, rm, symlink, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FaqFileStorage, validateFaqFile } from '../../src/modules/faqs/faqs-file-storage';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'faq-storage-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function upload(name: string, contents: string | Buffer): Express.Multer.File {
  const buffer = Buffer.from(contents);
  return {
    originalname: name,
    buffer,
    size: buffer.length,
    mimetype: 'application/octet-stream',
  } as Express.Multer.File;
}

describe('FAQ file storage', () => {
  it('stores two independent files and returns their original content', async () => {
    const storage = new FaqFileStorage(root);
    const first = await storage.save(upload('คู่มือ.pdf', '%PDF-first'));
    const second = await storage.save(upload('notes.txt', 'plain text'));
    expect(first.id).not.toBe(second.id);
    expect(first.fileName).toBe('คู่มือ.pdf');
    expect(await readFile(await storage.getPath(first), 'utf8')).toBe('%PDF-first');
    expect(await readFile(await storage.getPath(second), 'utf8')).toBe('plain text');
    await storage.remove(first);
    await expect(storage.getPath(first)).rejects.toMatchObject({ statusCode: 404 });
    await storage.remove(first);
  });

  it.each([
    ['fake.pdf', 'not a pdf'],
    ['script.html', '<script>'],
    ['empty.txt', ''],
    ['binary.txt', '\0abc'],
  ])('rejects invalid file %s', (name, contents) => {
    expect(() => validateFaqFile(upload(name, contents))).toThrow();
  });

  it('rejects oversized files and mismatching buffer lengths', () => {
    expect(() => validateFaqFile(upload('large.txt', Buffer.alloc(10485761, 65)))).toThrow();
    expect(() => validateFaqFile({ ...upload('small.txt', 'hello'), size: 999 })).toThrow();
  });

  it('does not read paths outside its private root, including symlinks', async () => {
    const storage = new FaqFileStorage(root);
    const file = await storage.save(upload('file.pdf', '%PDF-test'));
    await expect(storage.getPath({ ...file, storagePath: '../outside' })).rejects.toMatchObject({
      statusCode: 404,
    });
    const outside = path.join(root, 'outside.pdf');
    await writeFile(outside, '%PDF-test');
    await storage.remove(file);
    await symlink(outside, path.join(root, '.private', 'faqs', file.id));
    await expect(storage.getPath(file)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('does not write through a private root symlink pointing outside the upload directory', async () => {
    const uploadRoot = path.join(root, 'uploads');
    await mkdir(path.join(uploadRoot, '.private'), { recursive: true });
    const outside = path.join(root, 'outside');
    await mkdir(outside);
    await symlink(outside, path.join(uploadRoot, '.private', 'faqs'));
    await expect(
      new FaqFileStorage(uploadRoot).save(upload('file.pdf', '%PDF-test')),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
