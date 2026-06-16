const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });
const mongoose = require('mongoose');

const beneficiarySchema = new mongoose.Schema({});
const Beneficiary = mongoose.model('Beneficiary', beneficiarySchema);

const englishBeneficiarySchema = new mongoose.Schema({});
const EnglishBeneficiary = mongoose.model('EnglishBeneficiary', englishBeneficiarySchema);

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI;
  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  console.log('Clearing beneficiaries...');
  const res1 = await Beneficiary.deleteMany({});
  console.log(`Deleted ${res1.deletedCount} Arabic Beneficiary documents.`);

  console.log('Clearing english_beneficiaries...');
  const res2 = await EnglishBeneficiary.deleteMany({});
  console.log(`Deleted ${res2.deletedCount} English Beneficiary documents.`);

  await mongoose.disconnect();
  console.log('MongoDB data cleared successfully.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
