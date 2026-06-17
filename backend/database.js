const mongoose = require('mongoose');

function cleanEnvVar(val) {
  if (!val) return val;
  let cleaned = val.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.trim();
}

const MONGODB_URI = cleanEnvVar(process.env.MONGODB_URI) || 'mongodb://localhost:27017/benapp';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB database');
    seedInitialData();
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB database:', err);
  });

const transformOptions = {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    return ret;
  }
};

// 1. User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'arabic_viewer', enum: ['admin', 'arabic_viewer', 'english_viewer'] },
  created_at: { type: Date, default: Date.now }
});
userSchema.set('toJSON', transformOptions);
userSchema.set('toObject', transformOptions);
const User = mongoose.model('User', userSchema);

// 2. Beneficiary Schema
const beneficiarySchema = new mongoose.Schema({
  code: { type: String, index: true },
  name: { type: String, required: true },
  normalized_name: { type: String, required: true, index: true },
  gender: String,
  birth_date: String,
  marital_status: String,
  id_type: String,
  id_number: { type: String, index: true },
  occupation: String,
  partner_name: String,
  partner_gender: String,
  partner_id_type: String,
  partner_id_number: String,
  family_status: String,
  governorate: { type: String, index: true },
  district: String,
  region: String,
  children_count: { type: Number, default: 0 },
  adults_count: { type: Number, default: 0 },
  elderly_count: { type: Number, default: 0 },
  total_family_count: { type: Number, default: 0 },
  phone: { type: String, index: true },
  backup_phone: String,
  delegate_name: { type: String, index: true },
  delegate_phone: String,
  survey_area: String,
  notes: String,
  card_status: { type: String, default: 'pending', enum: ['pending', 'linked', 'missing'] },
  card_image_path: String,
  googleDriveFileId: String,
  cloudinary_url: String,
  cloudinary_public_id: String,
  extra_data: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});
beneficiarySchema.set('toJSON', transformOptions);
beneficiarySchema.set('toObject', transformOptions);
const Beneficiary = mongoose.model('Beneficiary', beneficiarySchema);

// 3. English Beneficiary Schema
const englishBeneficiarySchema = new mongoose.Schema({
  arabic_beneficiary_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Beneficiary', required: true, index: true },
  code: { type: String, index: true },
  name: { type: String, required: true },
  gender: String,
  birth_date: String,
  marital_status: String,
  id_type: String,
  id_number: String,
  occupation: String,
  partner_name: String,
  partner_gender: String,
  partner_id_type: String,
  partner_id_number: String,
  family_status: String,
  governorate: String,
  district: String,
  region: String,
  children_count: { type: Number, default: 0 },
  adults_count: { type: Number, default: 0 },
  elderly_count: { type: Number, default: 0 },
  total_family_count: { type: Number, default: 0 },
  phone: String,
  backup_phone: String,
  delegate_name: String,
  delegate_phone: String,
  survey_area: String,
  notes: String,
  card_status: String,
  googleDriveFileId: String,
  last_translated_arabic_data: { type: Map, of: String, default: {} },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});
englishBeneficiarySchema.set('toJSON', transformOptions);
englishBeneficiarySchema.set('toObject', transformOptions);
const EnglishBeneficiary = mongoose.model('EnglishBeneficiary', englishBeneficiarySchema);

// 4. Project Schema
const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  beneficiaries: [{
    beneficiary_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Beneficiary', required: true },
    status: { type: String, default: 'pending', enum: ['pending', 'linked', 'missing'] },
    created_at: { type: Date, default: Date.now }
  }],
  created_at: { type: Date, default: Date.now }
});
projectSchema.set('toJSON', transformOptions);
projectSchema.set('toObject', transformOptions);
const Project = mongoose.model('Project', projectSchema);

// 5. Translation Config Schema
const translationConfigSchema = new mongoose.Schema({
  apiKey: { type: String, default: '' },
  provider: { type: String, default: 'gemini', enum: ['gemini', 'openai'] },
  systemPrompt: { type: String, default: 'Translate this beneficiary record to English. Convert name into its English phonetic equivalent. Keep formatting consistent.' },
  dictionary: { type: Map, of: String, default: {
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
  } },
  arabicViewerPassword: { type: String, default: 'viewer' },
  englishViewerPassword: { type: String, default: 'viewer' },
  isTranslationActive: { type: Boolean, default: true }
});
translationConfigSchema.set('toJSON', transformOptions);
translationConfigSchema.set('toObject', transformOptions);
const TranslationConfig = mongoose.model('TranslationConfig', translationConfigSchema);

// Arabic Normalizer Helper
function normalizeArabicName(name) {
  if (name === null || name === undefined) return "";
  let clean = String(name).trim().toLowerCase();
  clean = clean.replace(/[\u064B-\u065F]/g, "");
  clean = clean.replace(/[أإآ]/g, "ا");
  clean = clean.replace(/ة\b/g, "ه");
  clean = clean.replace(/ى\b/g, "ي");
  clean = clean.replace(/عبد\s+ال/g, "عبدال");
  clean = clean.replace(/\b(بن|ابن)\b/g, "");
  clean = clean.replace(/[^\u0621-\u064A0-9]/g, "");
  clean = clean.replace(/\s+/g, "");
  return clean;
}

// Initial Data Seeding
async function seedInitialData() {
  try {
    // 1. Seed Users (clear and re-seed to apply new schema constraints)
    try {
      await User.collection.drop();
    } catch (e) {
      // ignore if collection does not exist yet
    }
    await User.create([
      { username: 'admin', name: 'المدير', password: 'admin', role: 'admin' },
      { username: 'arabic', name: 'متصفح عربي', password: 'viewer', role: 'arabic_viewer' },
      { username: 'english', name: 'English Viewer', password: 'viewer', role: 'english_viewer' }
    ]);
    console.log('Seeded default admin, arabic_viewer, and english_viewer users in MongoDB.');

    // 2. Seed Translation Config
    const configCount = await TranslationConfig.countDocuments();
    if (configCount === 0) {
      await TranslationConfig.create({});
      console.log('Seeded default Translation Config.');
    }
  } catch (error) {
    console.error('Error seeding initial data:', error);
  }
}

module.exports = {
  mongoose,
  User,
  Beneficiary,
  EnglishBeneficiary,
  Project,
  TranslationConfig,
  normalizeArabicName
};
