import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import Vital from '../src/models/Vital.js';
import Device from '../src/models/Device.js';
import vitalRoutes from '../src/routes/vitalRoutes.js';
import routes from '../src/routes/hardwareRoutes.js';
import { hashHardwareToken } from '../src/utils/hardwareToken.js';

// HTTP contract tests with a model double. These do not verify MongoDB storage.
test('hardware HTTP authentication, validation and error contracts', async (t) => {
  const originalFindOne = Vital.findOne;
  Vital.findOne = filter => ({ sort: async () => {
    assert.equal(filter.source, "sensor");
    assert.ok(filter.measuredAt.$gte instanceof Date);
    return null;
  } });
  const originalVitalCreate = Vital.create;
  const saved = [];
  Vital.create = async data => { saved.push(data); return data; };
  const originalCreate = Device.create;
  const originalUpdate = Device.findOneAndUpdate;
  const records = new Map();
  let databaseFailure = false;
  Device.create = async (data) => {
    if (databaseFailure) throw new Error('database unavailable');
    if (records.has(data.deviceId)) throw Object.assign(new Error('duplicate'), { code: 11000, keyPattern: { deviceId: 1 } });
    const record = { ...data, _id: 'test-id', active: true, lastSeen: null };
    records.set(data.deviceId, record);
    return record;
  };
  Device.findOneAndUpdate = async (filter, update, options) => {
    assert.equal(options.returnDocument, 'after');
    if (databaseFailure) throw new Error('database unavailable');
    const record = [...records.values()].find((value) => value.apiTokenHash === filter.apiTokenHash && value.active === true);
    if (record) Object.assign(record, update.$set);
    return record;
  };
  const app = express();
  app.use(express.json());
  app.use('/api/hardware', routes);
  app.use('/api/vitals', vitalRoutes);
  app.use((error, req, res, next) => {
    res.status(error.type === 'entity.parse.failed' ? 400 : 500).json({ success: false });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    Vital.findOne = originalFindOne;
    Vital.create = originalVitalCreate;
    Device.create = originalCreate;
    Device.findOneAndUpdate = originalUpdate;
    await new Promise((resolve) => server.close(resolve));
  });
  const request = async (path, body, token) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/hardware/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'X-API-KEY': token } : {}) }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const vitalURL = `http://127.0.0.1:${server.address().port}/api/vitals`;
  assert.equal((await fetch(vitalURL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 410);
  assert.equal((await fetch(`${vitalURL}/PAT-TEST-001`)).status, 404);
  const registration = { deviceId: 'PK-TEST-001', name: 'Test device' };
  const reading = { deviceId: registration.deviceId, heartRate: 78, oxygenLevel: 98, temperature: 37.1, timestamp: new Date().toISOString() };
  assert.equal((await request('register', {})).status, 400);
  assert.equal((await request('register', { ...registration, deviceId: { $ne: null } })).status, 400);
  assert.equal((await request('register', { ...registration, active: false })).status, 400);
  const created = await request('register', registration);
  assert.equal(created.status, 201);
  assert.match(created.body.apiToken, /^[a-f0-9]{64}$/);
  assert.equal(created.body.device.apiTokenHash, undefined);
  const token = created.body.apiToken;
  const record = records.get(registration.deviceId);
  assert.equal(record.apiTokenHash, hashHardwareToken(token));
  assert.equal(record.apiToken, undefined);
  assert.equal((await request('register', registration)).status, 409);
  assert.equal((await request('update', reading)).status, 401);
  assert.equal((await request('update', reading, '0'.repeat(64))).status, 401);
  assert.equal((await request('update', reading, token)).status, 409);
  record.monitoringPatientId = 'PAT-TEST-001';
  assert.equal((await request('update', reading, token)).status, 200);
  assert.equal(saved[0].patientId, 'PAT-TEST-001');
  assert.equal(saved[0].spo2, 98);
  assert.equal(saved[0].systolic, undefined);
  assert.equal((await request('update', { ...reading, heartRate: null, oxygenLevel: null, temperature: null, leadsOff: true, ecgRaw: null }, token)).status, 200);
  assert.equal(saved[1].heartRate, null);
  assert.equal((await request('update', { ...reading, oxygenLevel: 101 }, token)).status, 400);
  assert.equal((await request('update', { ...reading, leadsOff: true, ecgRaw: 1000 }, token)).status, 400);
  assert.equal((await request('update', { ...reading, timestamp: '2020-01-01T00:00:00Z' }, token)).status, 400);
  assert.ok(record.lastSeen instanceof Date);
  assert.equal((await request('update', { ...reading, deviceId: 'OTHER' }, token)).status, 403);
  assert.equal((await request('update', { ...reading, heartRate: '78' }, token)).status, 400);
  assert.equal((await request('update', { ...reading, timestamp: 'bad' }, token)).status, 400);
  assert.equal((await request('update', null, token)).status, 400);
  record.active = false;
  assert.equal((await request('update', reading, token)).status, 401);
  databaseFailure = true;
  assert.equal((await request('update', reading, token)).status, 500);
  assert.equal((await request('register', { ...registration, deviceId: 'PK-TEST-002' })).status, 500);
});

test('Device schema indexes, reference, validation and hash redaction', async () => {
  const document = new Device({ deviceId: 'PK-TEST-001', name: 'Test', apiTokenHash: 'a'.repeat(64) });
  await document.validate();
  assert.equal(document.active, true);
  assert.equal(document.toJSON().apiTokenHash, undefined);
  assert.equal(document.toObject().apiTokenHash, undefined);
  assert.equal(Device.schema.path('patientId').options.ref, 'Patient');
  assert.equal(Device.schema.path('apiTokenHash').options.select, false);
  assert.ok(Device.schema.indexes().some(([fields, options]) => fields.deviceId === 1 && options.unique));
  await assert.rejects(new Device({ deviceId: 'bad id', name: 'Test' }).validate());
});

test('sensor records allow unavailable measurements and do not default blood pressure', async () => {
  const vital = new Vital({ patientId: 'PAT-TEST-001', source: 'sensor', heartRate: null, spo2: null, temperature: null });
  await vital.validate();
  assert.equal(vital.heartRate, null);
  assert.equal(vital.systolic, null);
  assert.equal(vital.diastolic, null);
});
