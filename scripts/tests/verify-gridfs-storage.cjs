const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');

process.env.NODE_ENV = 'test';
process.env.PHARMACHAIN_FILE_STORAGE_BACKEND = 'gridfs';
process.env.PHARMACHAIN_FILE_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const mongoose = require('mongoose');
const files = new Map();
const objects = new Map();
const fakeDb = {
  collection(name) {
    assert.ok(['prescriptionFiles.files', 'prescriptionFiles.chunks'].includes(name));
    return name.endsWith('.files')
      ? {
        findOne: async (query) => {
          const file = files.get(query._id);
          return file
            && file.metadata.organizationHash === query['metadata.organizationHash']
            && file.metadata.encrypted === query['metadata.encrypted']
            ? file
            : null;
        },
      }
      : {};
  },
};

class FakeGridFSBucket {
  constructor(db) {
    assert.equal(db, fakeDb);
  }

  openUploadStreamWithId(id, filename, { metadata }) {
    const chunks = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
      final(callback) {
        const data = Buffer.concat(chunks);
        objects.set(id, data);
        files.set(id, { _id: id, filename, length: data.length, metadata });
        callback();
      },
    });
    return stream;
  }

  openDownloadStream(id) {
    const data = objects.get(id);
    if (!data) {
      const error = new Error('GridFS file missing');
      error.code = 'ENOENT';
      throw error;
    }
    return Readable.from([data]);
  }
}

mongoose.connection.db = fakeDb;
mongoose.connection.readyState = 1;
Object.defineProperty(mongoose.mongo, 'GridFSBucket', {
  configurable: true,
  value: FakeGridFSBucket,
});

const storage = require('../../server/services/fileStorageService.cjs');

async function main() {
  let passed = 0;
  const check = async (name, assertion) => {
    await assertion();
    passed += 1;
    console.log(`PASS  ${name}`);
  };

  const image = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('test image bytes'),
  ]);
  const metadata = await storage.saveFile({
    buffer: image,
    mimetype: 'image/png',
    originalName: 'test.png',
    organizationId: 'tenant-private-name',
  });
  const gridFile = files.get(metadata.fileId);

  await check('GridFS stores encrypted bytes with tenant hash metadata', () => {
    assert.equal(gridFile.metadata.encrypted, true);
    assert.equal(gridFile.metadata.originalSize, image.length);
    assert.match(gridFile.metadata.organizationHash, /^[a-f0-9]{64}$/);
    assert.notEqual(gridFile.metadata.organizationHash, 'tenant-private-name');
    assert.equal(objects.get(metadata.fileId).includes(image), false);
  });
  await check('encrypted GridFS file round-trips to the original image', async () => {
    assert.deepEqual(await storage.readFile({
      organizationId: 'tenant-private-name',
      fileId: metadata.fileId,
    }), image);
  });
  await check('a different tenant cannot read the GridFS file', async () => {
    await assert.rejects(
      storage.readFile({ organizationId: 'another-tenant', fileId: metadata.fileId }),
      (error) => error.status === 404,
    );
  });
  await check('missing GridFS file returns 404', async () => {
    await assert.rejects(
      storage.readFile({ organizationId: 'tenant-private-name', fileId: 'missing-file-id' }),
      (error) => error.status === 404,
    );
  });

  objects.set(metadata.fileId, Buffer.from(objects.get(metadata.fileId)));
  objects.get(metadata.fileId)[objects.get(metadata.fileId).length - 1] ^= 1;
  await check('tampered ciphertext is rejected', async () => {
    await assert.rejects(
      storage.readFile({ organizationId: 'tenant-private-name', fileId: metadata.fileId }),
      (error) => error.status === 500,
    );
  });
  await check('truncated stored files are rejected before decryption', async () => {
    files.get(metadata.fileId).length = 12;
    await assert.rejects(
      storage.readFile({ organizationId: 'tenant-private-name', fileId: metadata.fileId }),
      (error) => error.status === 500,
    );
  });

  console.log(`\n${passed} GridFS storage checks passed`);
}

main().catch((error) => {
  console.error(`GridFS storage check failed: ${error.message}`);
  process.exitCode = 1;
});
