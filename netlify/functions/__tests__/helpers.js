const jwt = require('jsonwebtoken');

// Signs a token in the same shape as auth-login.js — tests build the
// authUser payload directly rather than going through a real login,
// since what's under test is authorization logic, not authentication.
function makeToken({ userId, role, branches = [], departments = [], territories = [] }) {
  return jwt.sign(
    { userId: String(userId), role, branches: branches.map(String), departments: departments.map(String), territories: territories.map(String) },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Mimics the event object Netlify passes to a function handler.
function makeEvent({ method = 'GET', token, query = {}, body = null }) {
  return {
    httpMethod: method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    queryStringParameters: query,
    body: body ? JSON.stringify(body) : null,
  };
}

module.exports = { makeToken, makeEvent };
