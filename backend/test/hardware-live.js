import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Vital from '../src/models/Vital.js';
import Device from '../src/models/Device.js';
import { hashHardwareToken } from '../src/utils/hardwareToken.js';

dotenv.config({ quiet: true });
const deviceId = `PK-VERIFY-${randomBytes(8).toString('hex')}`;
const base = process.env.HARDWARE_TEST_BASE_URL || `http://127.0.0.1:${process.env.PORT || 5005}`;
let createdId;
try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const request = async (path, body, token) => {
    const response = await fetch(`${base}/api/hardware/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'X-API-KEY': token } : {}) }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const registration = { deviceId, name: 'Temporary hardware verification device' };
  const created = await request('register', registration);
  assert.equal(created.status, 201);
  createdId = created.body.device.id;
  const token = created.body.apiToken;
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(created.body.device.apiTokenHash, undefined);
  const stored = await Device.collection.findOne({ deviceId });
  assert.equal(stored.apiTokenHash, hashHardwareToken(token));
  assert.equal(stored.apiToken, undefined);
  assert.ok(!JSON.stringify(stored).includes(token));
  const reading = { deviceId, heartRate: 78, oxygenLevel: 98, temperature: 37.1, timestamp: new Date().toISOString() };
  assert.equal((await request('update', reading)).status, 401);
  assert.equal((await request('update', reading, '0'.repeat(64))).status, 401);
  assert.equal((await request('update', reading, token)).status, 409);
  await Device.updateOne({ _id: createdId }, { $set: { monitoringPatientId: deviceId } });
  assert.equal((await request('update', reading, token)).status, 200);
  const saved = await Vital.findOne({ deviceId });
  assert.equal(saved.patientId, deviceId);
  assert.equal(saved.spo2, reading.oxygenLevel);
  assert.equal(saved.systolic, null);
  assert.equal(saved.diastolic, null);
  const after = await Device.findById(createdId);
  assert.ok(after.lastSeen instanceof Date);
  assert.equal((await request('register', registration)).status, 409);
  assert.equal((await request('update', { ...reading, deviceId: 'OTHER' }, token)).status, 403);
  assert.equal((await request('update', { ...reading, heartRate: '78' }, token)).status, 400);
  await Device.updateOne({ _id: createdId }, { $set: { active: false } });
  assert.equal((await request('update', reading, token)).status, 401);
  console.log('Live MongoDB verification passed: registration, token hash storage, missing/invalid/valid/inactive authentication, duplicate ID, device binding, validation, sensor persistence and lastSeen.');
} finally {
  if (createdId) {
    await Vital.deleteMany({ deviceId, patientId: deviceId });
    await Device.deleteOne({ _id: createdId, deviceId });
  }
  await mongoose.disconnect();
}
