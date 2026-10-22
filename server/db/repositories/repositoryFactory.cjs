// Generic repository: MongoDB (mongoose) when connected, otherwise an
// in-memory Map store with the same async API. Routes never touch raw arrays.
const { isMongoActive } = require('../connection.cjs');

function plain(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  delete o._id;
  delete o.__v;
  return o;
}

/** In-memory collection with id + createdAt/updatedAt semantics. */
function memoryCollection() {
  const items = new Map();
  let seq = 0;
  return {
    items,
    nextId(prefix) { seq += 1; return `${prefix}-${String(seq).padStart(6, '0')}`; },
  };
}

// One shared store per collection name for the whole process, so every
// createRepository({ name }) call sees the same rows in in-memory mode.
const STORES = new Map();
function sharedStore(name) {
  if (!STORES.has(name)) STORES.set(name, memoryCollection());
  return STORES.get(name);
}

function buildFilters(query, memoryItems) {
  // Very small subset used by the app; runs against in-memory items.
  let list = [...memoryItems.values()];
  const { filter = {}, sort = {}, page, limit, search, searchFields = [] } = query;
  const match = (item) => Object.entries(filter).every(([k, v]) => {
    if (v === undefined || v === null || v === '') return true;
    if (Array.isArray(v)) return v.includes(item[k]);
    return String(item[k]) === String(v);
  });
  list = list.filter(match);
  if (search) {
    const s = String(search).toLowerCase();
    list = list.filter((item) => searchFields.some((f) => String(item[f] ?? '').toLowerCase().includes(s)));
  }
  const sortKeys = Object.entries(sort);
  if (sortKeys.length) {
    list.sort((a, b) => {
      for (const [k, dir] of sortKeys) {
        const av = a[k]; const bv = b[k];
        if (av === bv) continue;
        return (av > bv ? 1 : -1) * (dir === 1 || dir === 'asc' ? 1 : -1);
      }
      return 0;
    });
  }
  const total = list.length;
  if (page && limit) {
    list = list.slice((page - 1) * limit, page * limit);
  } else if (limit) {
    list = list.slice(0, limit);
  }
  return { list, total };
}

function createRepository({ name, model, prefix, searchFields = [] }) {
  const mem = sharedStore(name);

  async function create(data) {
    // Every row gets a stable `id` regardless of storage mode — routes and
    // updateById/findOne rely on it. In MongoDB the id must be unique across
    // restarts, so it falls back to a fresh ObjectId when no explicit id is
    // supplied (a per-process counter would collide after every restart).
    const withId = {
      ...data,
      id: data.id || (isMongoActive() ? new (require('mongoose').Types.ObjectId)().toString() : mem.nextId(prefix)),
    };
    if (isMongoActive()) {
      const doc = await model.create(withId);
      return plain(doc);
    }
    const now = new Date().toISOString();
    const item = {
      ...withId,
      createdAt: withId.createdAt || now,
      updatedAt: now,
    };
    mem.items.set(item.id, item);
    return { ...item };
  }

  async function insertMany(rows) {
    if (!Array.isArray(rows)) throw new TypeError('insertMany requires an array');
    if (isMongoActive()) {
      const withIds = rows.map((row) => ({
        ...row,
        id: row.id || new (require('mongoose').Types.ObjectId)().toString(),
      }));
      const docs = await model.insertMany(withIds);
      return docs.map(plain);
    }
    const inserted = [];
    for (const row of rows) inserted.push(await create(row));
    return inserted;
  }

  async function findById(id) {
    if (isMongoActive()) {
      const doc = await model.findOne({ id }).lean();
      return plain(doc);
    }
    return mem.items.get(id) ? { ...mem.items.get(id) } : null;
  }

  async function findOne(match) {
    if (isMongoActive()) {
      const doc = await model.findOne(match).lean();
      return plain(doc);
    }
    for (const item of mem.items.values()) {
      if (Object.entries(match).every(([k, v]) => String(item[k]) === String(v))) return { ...item };
    }
    return null;
  }

  async function updateById(id, patch) {
    if (isMongoActive()) {
      const doc = await model.findOneAndUpdate(
        { id }, { $set: { ...patch, updatedAt: new Date() } }, { new: true },
      ).lean();
      if (doc) return plain(doc);
      // Fallback for legacy rows written before ids were guaranteed: try the
      // domain keys so updates never silently miss their record.
      const legacy = await model.findOneAndUpdate(
        { $or: [{ prescriptionId: id }, { code: id }] },
        { $set: { ...patch, updatedAt: new Date() } }, { new: true },
      ).lean();
      return plain(legacy);
    }
    const item = mem.items.get(id);
    if (!item) return null;
    Object.assign(item, patch, { updatedAt: new Date().toISOString() });
    return { ...item };
  }

  async function find(query = {}) {
    const { filter = {}, sort = { createdAt: -1 }, page, limit } = query;
    if (isMongoActive()) {
      const q = model.find(filter).sort(sort);
      let items;
      let total;
      if (page && limit) {
        items = await q.skip((page - 1) * limit).limit(limit).lean();
        total = await model.countDocuments(filter);
      } else {
        if (limit) q.limit(limit);
        items = await q.lean();
        total = limit ? await model.countDocuments(filter) : items.length;
      }
      return { items: items.map(plain), total };
    }
    const { list, total } = buildFilters({ filter, sort, page, limit, search: query.search, searchFields }, mem.items);
    return { items: list.map((i) => ({ ...i })), total };
  }

  async function count(filter = {}) {
    if (isMongoActive()) return model.countDocuments(filter);
    let n = 0;
    for (const item of mem.items.values()) {
      if (Object.entries(filter).every(([k, v]) => (Array.isArray(v) ? v.includes(item[k]) : String(item[k]) === String(v)))) n += 1;
    }
    return n;
  }

  async function deleteById(id) {
    if (isMongoActive()) {
      await model.deleteOne({ id });
      return true;
    }
    return mem.items.delete(id);
  }

  return { name, create, insertMany, findById, findOne, updateById, find, count, deleteById, _mem: mem };
}

module.exports = { createRepository, plain };
