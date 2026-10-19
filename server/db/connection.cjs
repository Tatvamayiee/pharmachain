// Database connection with explicit in-memory fallback.
// Never logs connection strings or credentials.
const mongoose = require('mongoose');
const { MONGODB_URI, DB_MODE_CONFIGURED, IS_DEV } = require('../config/env.cjs');

let mode = 'in-memory'; // 'mongodb' | 'in-memory'
let connected = false;

async function connect() {
  if (!MONGODB_URI) {
    mode = 'in-memory';
    connected = false;
    console.log('Database mode: in-memory fallback (no MongoDB URI configured)');
    return { mode, connected };
  }
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 4000,
    });
    mode = 'mongodb';
    connected = true;
    console.log('Database mode: MongoDB connected');
  } catch (err) {
    mode = 'in-memory';
    connected = false;
    console.log(`Database mode: in-memory fallback (MongoDB connection failed: ${err.name || 'error'})`);
    if (IS_DEV && err.message) console.log(`  [dev] ${String(err.message).slice(0, 160)}`);
  }
  return { mode, connected };
}

/** Close the MongoDB connection (used by graceful shutdown). Resolves even
 *  if nothing is connected — shutdown must never hang on this step. */
async function close() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('Database connection closed');
    }
  } catch (err) {
    console.error(`Database close warning: ${err && err.message ? err.message : 'error'}`);
  } finally {
    mode = 'in-memory';
    connected = false;
  }
}

function getMode() { return mode; }
function isConnected() { return connected; }
function isMongoActive() { return mode === 'mongodb' && connected; }

module.exports = { connect, close, getMode, isConnected, isMongoActive };
