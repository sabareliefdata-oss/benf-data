const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });
const mongoose = require('mongoose');
const { Beneficiary, EnglishBeneficiary, TranslationConfig } = require('./database');

function translateWithDict(text, dictionary) {
  if (!text) return '';
  const trimmed = String(text).trim();
  if (dictionary && dictionary[trimmed]) {
    return dictionary[trimmed];
  }
  
  const defaults = {
    'ذكر': 'Male',
    'أنثى': 'Female',
    'متزوج': 'Married',
    'اعزب': 'Single',
    'أعزب': 'Single',
    'مطلق': 'Divorced',
    'ارمل': 'Widowed',
    'أرمل': 'Widowed',
    'مربوطة': 'Linked',
    'مفقودة': 'Missing',
    'معلقة': 'Pending'
  };
  return defaults[trimmed] || trimmed;
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  console.log('Clearing existing English Beneficiaries...');
  await EnglishBeneficiary.deleteMany({});
  console.log('Cleared.');

  const config = await TranslationConfig.findOne() || { dictionary: {} };
  const dictObj = config.dictionary ? 
    (config.dictionary.toJSON ? config.dictionary.toJSON() : config.dictionary) : {};

  console.log('Fetching Arabic Beneficiaries...');
  const bens = await Beneficiary.find({});
  console.log(`Found ${bens.length} Arabic Beneficiaries.`);

  const bulkDocs = bens.map(record => {
    const gender = translateWithDict(record.gender, dictObj);
    const maritalStatus = translateWithDict(record.marital_status, dictObj);
    const idType = translateWithDict(record.id_type, dictObj);
    const partnerGender = translateWithDict(record.partner_gender, dictObj);
    const partnerIdType = translateWithDict(record.partner_id_type, dictObj);
    const familyStatus = translateWithDict(record.family_status, dictObj);
    const governorate = translateWithDict(record.governorate, dictObj);
    const district = translateWithDict(record.district, dictObj);
    const cardStatus = translateWithDict(record.card_status, dictObj);

    return {
      arabic_beneficiary_id: record._id,
      code: record.code,
      name: record.name, // Fallback name
      gender,
      birth_date: record.birth_date,
      marital_status: maritalStatus,
      id_type: idType,
      id_number: record.id_number,
      occupation: record.occupation || '',
      partner_name: record.partner_name || '',
      partner_gender: partnerGender,
      partner_id_type: partnerIdType,
      partner_id_number: record.partner_id_number,
      family_status: familyStatus,
      governorate,
      district,
      region: record.region || '',
      children_count: record.children_count,
      adults_count: record.adults_count,
      elderly_count: record.elderly_count,
      total_family_count: record.total_family_count,
      phone: record.phone,
      backup_phone: record.backup_phone,
      delegate_name: translateWithDict(record.delegate_name, dictObj),
      delegate_phone: record.delegate_phone,
      survey_area: record.survey_area || '',
      notes: record.notes || '',
      card_status: cardStatus,
      googleDriveFileId: record.googleDriveFileId,
      created_at: record.created_at
    };
  });

  const batchSize = 200;
  for (let i = 0; i < bulkDocs.length; i += batchSize) {
    const batch = bulkDocs.slice(i, i + batchSize);
    await EnglishBeneficiary.insertMany(batch);
    console.log(`Saved batch ${i / batchSize + 1} (${Math.min(i + batchSize, bulkDocs.length)}/${bulkDocs.length})`);
  }

  await mongoose.disconnect();
  console.log('All English Beneficiaries populated successfully.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
