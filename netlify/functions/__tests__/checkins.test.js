const mongoose = require('mongoose');
const { connectDB } = require('../lib/db');
const Church = require('../models/Church');
const Branch = require('../models/Branch');
const Member = require('../models/Member');
const CheckIn = require('../models/CheckIn');
const { makeToken, makeEvent } = require('./helpers');
const { handler } = require('../checkins');

describe('checkins.js — idempotency and undo', () => {
  let branch, member, token;

  beforeAll(async () => {
    await connectDB();
    const church = await Church.create({ name: 'Test Church' });
    branch = await Branch.create({ church: church._id, name: 'Branch A', type: 'branch' });
    member = await Member.create({ branch: branch._id, firstName: 'Test', lastName: 'Member', status: 'member' });
    token = makeToken({ userId: new mongoose.Types.ObjectId(), role: 'branch_admin', branches: [branch._id] });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('a check-in is recorded and updates Member.lastAttendedAt', async () => {
    const event = makeEvent({
      method: 'POST',
      token,
      body: { branch: String(branch._id), member: String(member._id), clientEventId: 'evt-1' },
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(201);

    const updated = await Member.findById(member._id);
    expect(updated.lastAttendedAt).toBeTruthy();
  });

  test('regression: retrying the SAME clientEventId never creates a second record — this is the core offline-safety guarantee', async () => {
    const before = await CheckIn.countDocuments({ clientEventId: 'evt-1' });
    expect(before).toBe(1);

    const event = makeEvent({
      method: 'POST',
      token,
      body: { branch: String(branch._id), member: String(member._id), clientEventId: 'evt-1' },
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(200); // not 201 — nothing new was created

    const after = await CheckIn.countDocuments({ clientEventId: 'evt-1' });
    expect(after).toBe(1);
  });

  test('a user without access to the branch is rejected', async () => {
    const otherBranchToken = makeToken({ userId: new mongoose.Types.ObjectId(), role: 'branch_admin', branches: [new mongoose.Types.ObjectId()] });
    const event = makeEvent({
      method: 'POST',
      token: otherBranchToken,
      body: { branch: String(branch._id), member: String(member._id), clientEventId: 'evt-unauthorized' },
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(403);
  });

  test('GET returns the active check-in for today', async () => {
    const event = makeEvent({ method: 'GET', token, query: { branchId: String(branch._id) } });
    const res = await handler(event);
    const body = JSON.parse(res.body);
    expect(body.some((c) => c.clientEventId === 'evt-1')).toBe(true);
  });

  test('undo (a reversal record) removes the member from the active list without deleting anything', async () => {
    const undoEvent = makeEvent({
      method: 'POST',
      token,
      body: {
        branch: String(branch._id),
        member: String(member._id),
        clientEventId: 'evt-1-undo',
        reversalOf: 'evt-1',
      },
    });
    const undoRes = await handler(undoEvent);
    expect(undoRes.statusCode).toBe(201);

    const originalStillExists = await CheckIn.findOne({ clientEventId: 'evt-1' });
    const reversalExists = await CheckIn.findOne({ clientEventId: 'evt-1-undo' });
    expect(originalStillExists).toBeTruthy();
    expect(reversalExists).toBeTruthy();

    const getEvent = makeEvent({ method: 'GET', token, query: { branchId: String(branch._id) } });
    const getRes = await handler(getEvent);
    const body = JSON.parse(getRes.body);
    expect(body.some((c) => c.clientEventId === 'evt-1')).toBe(false);
    expect(body.some((c) => c.clientEventId === 'evt-1-undo')).toBe(false);
  });

  test('a reversal does not update lastAttendedAt', async () => {
    const before = await Member.findById(member._id);
    const undoEvent = makeEvent({
      method: 'POST',
      token,
      body: {
        branch: String(branch._id),
        member: String(member._id),
        clientEventId: 'evt-2',
        reversalOf: 'evt-1-should-not-exist',
      },
    });
    await handler(undoEvent);
    const after = await Member.findById(member._id);
    expect(String(after.lastAttendedAt)).toBe(String(before.lastAttendedAt));
  });
});
