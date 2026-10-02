const Church = require('../models/Church');

async function getOrCreateChurch() {
  let church = await Church.findOne();
  if (!church) {
    church = await Church.create({ name: 'Dominion City Church' });
  }
  return church;
}

async function getChurchId() {
  const church = await getOrCreateChurch();
  return church._id;
}

module.exports = { getOrCreateChurch, getChurchId };

