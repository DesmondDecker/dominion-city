const mongoose = require('mongoose');
const { connectDB } = require('../lib/db');
const Church = require('../models/Church');
const Branch = require('../models/Branch');
const WelfareCase = require('../models/WelfareCase');
const WelfareRequest = require('../models/WelfareRequest');
const { makeToken, makeEvent } = require('./helpers');
const { handler } = require('../welfare-requests');

describe('welfare-requests.js PATCH — approval access control', () => {
  let church, branchA, branchB, caseInA, requestInA;

  beforeAll(async () => {
    await connectDB();
    church = await Church.create({ name: 'Test Church' });
    branchA = await Branch.create({ church: church._id, name: 'Branch A', type: 'branch' });
    branchB = await Branch.create({ church: church._id, name: 'Branch B', type: 'branch' });
    caseInA = await WelfareCase.create({
      branch: branchA._id,
      member: new mongoose.Types.ObjectId(),
      category: 'food',
      summary: 'Test case',
      openedBy: new mongoose.Types.ObjectId(),
    });
    requestInA = await WelfareRequest.create({ case: caseInA._id, type: 'financial', amountRequested: 100 });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('a branch_admin scoped to the case\'s own branch CAN approve the request', async () => {
    const token = makeToken({ userId: new mongoose.Types.ObjectId(), role: 'branch_admin', branches: [branchA._id] });
    const event = makeEvent({
      method: 'PATCH',
      token,
      query: { id: String(requestInA._id) },
      body: { status: 'approved' },
    });

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
  });

  test('regression: a branch_admin scoped to a DIFFERENT branch cannot approve this request (previously the role check alone was sufficient, with no per-case branch check)', async () => {
    const token = makeToken({ userId: new mongoose.Types.ObjectId(), role: 'branch_admin', branches: [branchB._id] });
    const event = makeEvent({
      method: 'PATCH',
      token,
      query: { id: String(requestInA._id) },
      body: { status: 'approved' },
    });

    const res = await handler(event);
    // loadCaseWithAccess rejects this before the branch_admin/national_admin
    // role check is even reached — that rejection is a 404 (case access
    // denied), not a 403, so either is an acceptable "not allowed" outcome
    // here, but 200 (success) must never happen.
    expect(res.statusCode).not.toBe(200);
    expect([403, 404]).toContain(res.statusCode);
  });

  test('a caseworker (non-admin role) with legitimate case access still cannot approve their own request', async () => {
    const caseworkerId = new mongoose.Types.ObjectId();
    await WelfareCase.findByIdAndUpdate(caseInA._id, { assignedCaseworker: caseworkerId });
    const token = makeToken({ userId: caseworkerId, role: 'campus_staff', branches: [] });
    const event = makeEvent({
      method: 'PATCH',
      token,
      query: { id: String(requestInA._id) },
      body: { status: 'approved' },
    });

    const res = await handler(event);
    expect(res.statusCode).toBe(403);
  });

  test('approving a request for a non-existent id returns 404, not a crash', async () => {
    const token = makeToken({ userId: new mongoose.Types.ObjectId(), role: 'national_admin' });
    const event = makeEvent({
      method: 'PATCH',
      token,
      query: { id: String(new mongoose.Types.ObjectId()) },
      body: { status: 'approved' },
    });

    const res = await handler(event);
    expect(res.statusCode).toBe(404);
  });
});
