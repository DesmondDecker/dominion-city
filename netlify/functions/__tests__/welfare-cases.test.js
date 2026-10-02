const mongoose = require('mongoose');
const { connectDB } = require('../lib/db');
const Church = require('../models/Church');
const Branch = require('../models/Branch');
const { makeToken, makeEvent } = require('./helpers');
const { handler } = require('../welfare-cases');

describe('welfare-cases.js POST — branch access control', () => {
  let church, branchA, branchB;

  beforeAll(async () => {
    await connectDB();
    church = await Church.create({ name: 'Test Church' });
    branchA = await Branch.create({ church: church._id, name: 'Branch A', type: 'branch' });
    branchB = await Branch.create({ church: church._id, name: 'Branch B', type: 'branch' });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('a branch_admin can create a case for their own branch', async () => {
    const token = makeToken({ userId: new mongoose.Types.ObjectId(), role: 'branch_admin', branches: [branchA._id] });
    const event = makeEvent({
      method: 'POST',
      token,
      body: {
        church: String(church._id),
        branch: String(branchA._id),
        member: String(new mongoose.Types.ObjectId()),
        category: 'food',
        summary: 'Needs groceries',
      },
    });

    const res = await handler(event);
    expect(res.statusCode).toBe(201);
  });

  test('regression: a branch_admin CANNOT create a case for a branch outside their scope (this endpoint originally had no access check at all)', async () => {
    const token = makeToken({ userId: new mongoose.Types.ObjectId(), role: 'branch_admin', branches: [branchA._id] });
    const event = makeEvent({
      method: 'POST',
      token,
      body: {
        church: String(church._id),
        branch: String(branchB._id), // outside their scope
        member: String(new mongoose.Types.ObjectId()),
        category: 'food',
        summary: 'Needs groceries',
      },
    });

    const res = await handler(event);
    expect(res.statusCode).toBe(403);
  });

  test('a request with no branch is rejected with a clear 400, not a generic 500', async () => {
    const token = makeToken({ userId: new mongoose.Types.ObjectId(), role: 'national_admin' });
    const event = makeEvent({
      method: 'POST',
      token,
      body: { church: String(church._id), member: String(new mongoose.Types.ObjectId()), category: 'food', summary: 'x' },
    });

    const res = await handler(event);
    expect(res.statusCode).toBe(400);
  });
});
