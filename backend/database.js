const mongoose = require('mongoose');

// Connect to MongoDB Atlas (Falls back to local DB for development)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/benapp';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB database');
    seedDefaultUsers();
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB database:', err);
  });

// JSON Transformation Options to map _id to id for frontend compatibility
const transformOptions = {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    return ret;
  }
};

// -------------------------------------------------------------
// Schemas & Models
// -------------------------------------------------------------

// 1. User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  password: { type: String, required: true, unique: true },
  role: { type: String, default: 'viewer', enum: ['admin', 'viewer'] },
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
  card_image_path: String, // format: /api/cards/{beneficiaryId} for proxy serving
  googleDriveFileId: String,
  cloudinary_url: String,
  cloudinary_public_id: String,
  extra_data: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  created_at: { type: Date, default: Date.now }
});
beneficiarySchema.set('toJSON', transformOptions);
beneficiarySchema.set('toObject', transformOptions);
const Beneficiary = mongoose.model('Beneficiary', beneficiarySchema);

// 3. Project Schema
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

// -------------------------------------------------------------
// Helpers & Initial Seed
// -------------------------------------------------------------

// Seed default users if table is empty
async function seedDefaultUsers() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await User.create([
        { name: 'المدير', password: 'admin', role: 'admin' },
        { name: 'متصفح', password: 'viewer', role: 'viewer' }
      ]);
      console.log('Seeded default admin and viewer users in MongoDB.');
    }
  } catch (error) {
    console.error('Error seeding default users:', error);
  }
}

// Arabic Naming Normalization Helper
function normalizeArabicName(name) {
  if (name === null || name === undefined) return "";
  let clean = String(name).trim().toLowerCase();
  
  // 1. Remove Arabic diacritics
  clean = clean.replace(/[\u064B-\u065F]/g, "");
  
  // 2. Normalize letters
  clean = clean.replace(/[أإآ]/g, "ا");
  
  // Normalize taa marbuta
  clean = clean.replace(/ة\b/g, "ه");
  
  // Normalize alef maksoura
  clean = clean.replace(/ى\b/g, "ي");
  
  // Normalize common variations in spaces
  clean = clean.replace(/عبد\s+ال/g, "عبدال");
  
  // 3. Remove "bin" or "ibn"
  clean = clean.replace(/\b(بن|ابن)\b/g, "");
  
  // 4. Remove non-arabic letters, numbers and spaces
  clean = clean.replace(/[^\u0621-\u064A0-9]/g, "");
  
  // 5. Remove all spaces
  clean = clean.replace(/\s+/g, "");
  
  return clean;
}

// Check for duplicate beneficiaries
async function checkDuplicateBeneficiary(name, phone, idNumber, excludeId = null) {
  const normalized = normalizeArabicName(name);

  // 1. Check ID Number
  if (idNumber && String(idNumber).trim() !== '') {
    const query = { id_number: String(idNumber).trim() };
    if (excludeId) query._id = { $ne: excludeId };
    const duplicate = await Beneficiary.findOne(query);
    if (duplicate) return { type: 'id_number', record: duplicate };
  }

  // 2. Check Phone
  if (phone && String(phone).trim() !== '') {
    const query = { phone: String(phone).trim() };
    if (excludeId) query._id = { $ne: excludeId };
    const duplicate = await Beneficiary.findOne(query);
    if (duplicate) return { type: 'phone', record: duplicate };
  }

  // 3. Check Normalized Name
  if (normalized !== '') {
    const query = { normalized_name: normalized };
    if (excludeId) query._id = { $ne: excludeId };
    const duplicate = await Beneficiary.findOne(query);
    if (duplicate) return { type: 'name', record: duplicate };
  }

  return null;
}

module.exports = {
  mongoose,
  User,
  Beneficiary,
  Project,
  normalizeArabicName,
  checkDuplicateBeneficiary
};
