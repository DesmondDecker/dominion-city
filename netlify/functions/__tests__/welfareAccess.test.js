const mongoose = require('mongoose');
const { connectDB } = require('../lib/db');
const Church = require('../models/Church');
const Branch = require('../models/Branch');
const WelfareCase = require('../models/WelfareCase');
const { loadCaseWithAccess, scopeCaseQuery } = require('../lib/welfareAccess');

describe('welfareAccess', () => {
  let branchA, branchB, caseInA, caseworkerId;

  beforeAll(async () => {
    await connectDB();
    const church = await Church.create({ name: 'Test Church' });
    branchA = await Branch.create({ church: church._id, name: 'Branch A', type: 'branch' });
    branchB = await Branch.create({ church: church._id, name: 'Branch B', type: 'branch' });
    caseworkerId = new mongoose.Types.ObjectId();
    caseInA = await WelfareCase.create({
      branch: branchA._id,
      member: new mongoose.Types.ObjectId(),
      category: 'financial_hardship',
      summary: 'Test case',
      openedBy: new mongoose.Types.ObjectId(),
      assignedCaseworker: caseworkerId,
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('loadCaseWithAccess', () => {
    test('national_admin can access any case', async () => {
      const authUser = { role: 'national_admin', userId: new mongoose.Types.ObjectId().toString() };
      const kase = await loadCaseWithAccess(authUser, caseInA._id);
      expect(String(kase._id)).toBe(String(caseInA._id));
    });

    test('branch_admin scoped to the case\'s branch can access it', async () => {
      const authUser = {
        role: 'branch_admin',
        userId: new mongoose.Types.ObjectId().toString(),
        branches: [String(branchA._id)],
      };
      const kase = await loadCaseWithAccess(authUser, caseInA._id);
      expect(String(kase._id)).toBe(String(caseInA._id));
    });

    test('branch_admin scoped to a DIFFERENT branch is rejected — and with 404, not 403, so a case\'s existence isn\'t confirmed', async () => {
      const authUser = {
        role: 'branch_admin',
        userId: new mongoose.Types.ObjectId().toString(),
        branches: [String(branchB._id)],
      };
      await expect(loadCaseWithAccess(authUser, caseInA._id)).rejects.toMatchObject({ statusCode: 404 });
    });

    test('regression: fellowship_leader scoped to the branch CAN access it (this role previously had no case access at all until the bug-fix pass)', async () => {
      const authUser = {
        role: 'fellowship_leader',
        userId: new mongoose.Types.ObjectId().toString(),
        branches: [String(branchA._id)],
      };
      const kase = await loadCaseWithAccess(authUser, caseInA._id);
      expect(String(kase._id)).toBe(String(caseInA._id));
    });

    test('the assigned caseworker can access it regardless of branch scope', async () => {
      const authUser = { role: 'campus_staff', userId: String(caseworkerId), branches: [] };
      const kase = await loadCaseWithAccess(authUser, caseInA._id);
      expect(String(kase._id)).toBe(String(caseInA._id));
    });

    test('an explicitly added additional viewer can access it', async () => {
      const viewerId = new mongoose.Types.ObjectId();
      await WelfareCase.findByIdAndUpdate(caseInA._id, { $push: { additionalViewers: viewerId } });
      const authUser = { role: 'campus_staff', userId: String(viewerId), branches: [] };
      const kase = await loadCaseWithAccess(authUser, caseInA._id);
      expect(String(kase._id)).toBe(String(caseInA._id));
    });

    test('an unrelated staff member — no scope, no assignment, not a viewer — gets 404', async () => {
      const authUser = { role: 'checkin_volunteer', userId: new mongoose.Types.ObjectId().toString(), branches: [] };
      await expect(loadCaseWithAccess(authUser, caseInA._id)).rejects.toMatchObject({ statusCode: 404 });
    });

    test('a non-existent case id returns 404', async () => {
      const authUser = { role: 'national_admin', userId: new mongoose.Types.ObjectId().toString() };
      await expect(loadCaseWithAccess(authUser, new mongoose.Types.ObjectId())).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('scopeCaseQuery', () => {
    test('national_admin\'s query returns every case, not just one branch', async () => {
      const authUser = { role: 'national_admin' };
      const results = await WelfareCase.find(scopeCaseQuery(authUser));
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    test('branch_admin\'s query only returns cases in their branch', async () => {
      const authUser = { role: 'branch_admin', branches: [String(branchA._id)] };
      const results = await WelfareCase.find(scopeCaseQuery(authUser));
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every((c) => String(c.branch) === String(branchA._id))).toBe(true);
    });

    test('branch_admin\'s query scoped to a branch with no cases finds nothing — never leaks another branch\'s cases', async () => {
      const authUser = { role: 'branch_admin', branches: [String(branchB._id)] };
      const results = await WelfareCase.find(scopeCaseQuery(authUser));
      expect(results.length).toBe(0);
    });

    test('a caseworker\'s query only returns cases assigned to them', async () => {
      const authUser = { role: 'campus_staff', userId: String(caseworkerId) };
      const results = await WelfareCase.find(scopeCaseQuery(authUser));
      expect(results.some((c) => String(c._id) === String(caseInA._id))).toBe(true);
    });

    test('a caseworker with no assignments and no viewer grants sees nothing', async () => {
      const authUser = { role: 'campus_staff', userId: String(new mongoose.Types.ObjectId()) };
      const results = await WelfareCase.find(scopeCaseQuery(authUser));
      expect(results.length).toBe(0);
    });
  });
});
