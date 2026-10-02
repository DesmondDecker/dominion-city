const { connectDB } = require('./lib/db');

exports.handler = async () => {
  try {
    await connectDB();
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
    };
  } catch (err) {
    console.error('health check failed:', err);
    return {
      statusCode: 503,
      body: JSON.stringify({ status: 'unhealthy' }),
    };
  }
};
