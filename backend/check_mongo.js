const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });
const mongoose = require('mongoose');

const transformOptions = {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    return ret;
  }
};

const beneficiarySchema = new mongoose.Schema({
  code: String,
  name: String,
  card_status: String,
  googleDriveFileId: String
});
const Beneficiary = mongoose.model('Beneficiary', beneficiarySchema);

const englishBeneficiarySchema = new mongoose.Schema({
  arabic_beneficiary_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Beneficiary' },
  code: String,
  name: String,
  card_status: String
});
const EnglishBeneficiary = mongoose.model('EnglishBeneficiary', englishBeneficiarySchema);

const translationConfigSchema = new mongoose.Schema({
  apiKey: String,
  provider: String,
  systemPrompt: String,
  dictionary: Map,
  arabicViewerPassword: { type: String, default: 'viewer' },
  englishViewerPassword: { type: String, default: 'viewer' }
});
const TranslationConfig = mongoose.model('TranslationConfig', translationConfigSchema);

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI;
  console.log('Connecting to:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  const totalAr = await Beneficiary.countDocuments();
  console.log('Total Arabic Beneficiaries in MongoDB:', totalAr);

  const totalEn = await EnglishBeneficiary.countDocuments();
  console.log('Total English Beneficiaries in MongoDB:', totalEn);

  const config = await TranslationConfig.findOne();
  console.log('Translation Config:', JSON.stringify(config, null, 2));

  if (totalAr > 0) {
    console.log('\nSample Arabic Record:');
    const sampleAr = await Beneficiary.findOne();
    console.log(sampleAr);
  }

  if (totalEn > 0) {
    console.log('\nSample English Record:');
    const sampleEn = await EnglishBeneficiary.findOne();
    console.log(sampleEn);
  }

  await mongoose.disconnect();
  console.log('Disconnected.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
