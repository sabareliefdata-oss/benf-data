const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });
const mongoose = require('mongoose');
const { 
  Beneficiary, 
  EnglishBeneficiary, 
  TranslationConfig 
} = require('./database');
const { translateRecord } = require('./translate');

async function testTranslationFlow() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in env!');
  }

  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  const config = await TranslationConfig.findOne();
  if (!config) {
    throw new Error('TranslationConfig not found in database!');
  }
  
  if (!config.apiKey || config.apiKey.trim() === '') {
    console.error('❌ Error: No translation API key is configured in the database! Please add an API key first.');
    await mongoose.disconnect();
    return;
  }

  console.log('Fetching one Arabic beneficiary...');
  const record = await Beneficiary.findOne({});
  if (!record) {
    console.log('No Arabic beneficiaries found in database. Please sync some first!');
    await mongoose.disconnect();
    return;
  }

  console.log('--- Raw Arabic Beneficiary ---');
  console.log({
    _id: record._id,
    code: record.code,
    name: record.name,
    gender: record.gender,
    marital_status: record.marital_status,
    id_type: record.id_type,
    id_number: record.id_number,
    occupation: record.occupation,
    family_status: record.family_status,
    governorate: record.governorate,
    district: record.district,
    region: record.region,
    delegate_name: record.delegate_name,
    survey_area: record.survey_area,
    phone: record.phone,
    googleDriveFileId: record.googleDriveFileId
  });

  console.log('\n--- Clearing previous English translation for this record (if any) ---');
  await EnglishBeneficiary.deleteOne({ arabic_beneficiary_id: record._id });

  console.log('\n--- Running translateRecord ---');
  await translateRecord(record, config);

  console.log('\n--- Fetching translated English record ---');
  const enRecord = await EnglishBeneficiary.findOne({ arabic_beneficiary_id: record._id });
  if (enRecord) {
    console.log('✅ Success! English Beneficiary found:');
    console.log({
      _id: enRecord._id,
      code: enRecord.code,
      name: enRecord.name,
      gender: enRecord.gender,
      marital_status: enRecord.marital_status,
      id_type: enRecord.id_type,
      id_number: enRecord.id_number,
      occupation: enRecord.occupation,
      family_status: enRecord.family_status,
      governorate: enRecord.governorate,
      district: enRecord.district,
      region: enRecord.region,
      delegate_name: enRecord.delegate_name,
      survey_area: enRecord.survey_area,
      phone: enRecord.phone,
      googleDriveFileId: enRecord.googleDriveFileId
    });
  } else {
    console.log('❌ Failed! English Beneficiary was not created in the database.');
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

testTranslationFlow().catch(console.error);
