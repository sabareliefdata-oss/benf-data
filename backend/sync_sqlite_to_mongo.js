const path = require('path');
// Load environment variables from the main project's backend .env
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });

const sqlite3 = require('d:/pro/Benapp/backend/node_modules/sqlite3').verbose();
const mongoose = require('mongoose');

// MongoDB Schemas matching database.js
const transformOptions = {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    return ret;
  }
};

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
  created_at: { type: Date, default: Date.now }
});
beneficiarySchema.set('toJSON', transformOptions);
beneficiarySchema.set('toObject', transformOptions);
const Beneficiary = mongoose.model('Beneficiary', beneficiarySchema);

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

const sqliteDbPath = 'd:\\pro\\Benapp\\backend\\database.sqlite';

function openSqlite() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(sqliteDbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function main() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  console.log('Opening SQLite Database...');
  const sqliteDb = await openSqlite();
  console.log('SQLite Connected.');

  // 1. Clear existing beneficiaries and projects in MongoDB first to start fresh
  console.log('Clearing existing beneficiaries and projects in MongoDB...');
  await Beneficiary.deleteMany({});
  await Project.deleteMany({});
  console.log('MongoDB collections cleared.');

  // 2. Fetch beneficiaries from SQLite
  console.log('Fetching beneficiaries from SQLite...');
  const sqliteBens = await dbAll(sqliteDb, 'SELECT * FROM beneficiaries');
  console.log(`Found ${sqliteBens.length} beneficiaries in SQLite.`);

  const sqliteToMongoIdMap = {}; // Maps SQLite id -> MongoDB ObjectId string

  // Insert beneficiaries into MongoDB in batches
  const batchSize = 200;
  for (let i = 0; i < sqliteBens.length; i += batchSize) {
    const batch = sqliteBens.slice(i, i + batchSize);
    const mongoDocs = batch.map(row => {
      const mongoId = new mongoose.Types.ObjectId();
      sqliteToMongoIdMap[row.id] = mongoId;

      let extra = {};
      try {
        if (row.extra_data) {
          extra = JSON.parse(row.extra_data);
        }
      } catch (e) {
        console.warn('Failed to parse extra_data JSON:', row.extra_data);
      }

      return {
        _id: mongoId,
        code: row.code,
        name: row.name,
        normalized_name: row.normalized_name || normalizeArabicName(row.name),
        gender: row.gender,
        birth_date: row.birth_date,
        marital_status: row.marital_status,
        id_type: row.id_type,
        id_number: row.id_number,
        occupation: row.occupation,
        partner_name: row.partner_name,
        partner_gender: row.partner_gender,
        partner_id_type: row.partner_id_type,
        partner_id_number: row.partner_id_number,
        family_status: row.family_status,
        governorate: row.governorate,
        district: row.district,
        region: row.region,
        children_count: row.children_count || 0,
        adults_count: row.adults_count || 0,
        elderly_count: row.elderly_count || 0,
        total_family_count: row.total_family_count || 0,
        phone: row.phone,
        backup_phone: row.backup_phone,
        delegate_name: row.delegate_name,
        delegate_phone: row.delegate_phone,
        survey_area: row.survey_area,
        notes: row.notes,
        card_status: row.card_status || 'pending',
        card_image_path: row.card_image_path,
        googleDriveFileId: row.googleDriveFileId || row.cloudinary_public_id, // fallback if stored differently
        cloudinary_url: row.cloudinary_url,
        cloudinary_public_id: row.cloudinary_public_id,
        extra_data: extra,
        created_at: row.created_at ? new Date(row.created_at) : new Date()
      };
    });

    await Beneficiary.insertMany(mongoDocs);
    console.log(`Uploaded batch ${i / batchSize + 1} (${Math.min(i + batchSize, sqliteBens.length)}/${sqliteBens.length})`);
  }

  // 3. Fetch projects from SQLite
  console.log('Fetching projects from SQLite...');
  const sqliteProjects = await dbAll(sqliteDb, 'SELECT * FROM projects');
  console.log(`Found ${sqliteProjects.length} projects in SQLite.`);

  // 4. Fetch project mapping
  console.log('Fetching project_beneficiaries mappings from SQLite...');
  const sqliteMappings = await dbAll(sqliteDb, 'SELECT * FROM project_beneficiaries');
  console.log(`Found ${sqliteMappings.length} mappings in SQLite.`);

  // Group mappings by project_id
  const projectMappings = {};
  for (const mapping of sqliteMappings) {
    if (!projectMappings[mapping.project_id]) {
      projectMappings[mapping.project_id] = [];
    }
    const mongoBenId = sqliteToMongoIdMap[mapping.beneficiary_id];
    if (mongoBenId) {
      projectMappings[mapping.project_id].push({
        beneficiary_id: mongoBenId,
        status: mapping.status || 'pending',
        created_at: mapping.created_at ? new Date(mapping.created_at) : new Date()
      });
    }
  }

  // Insert projects into MongoDB
  for (const proj of sqliteProjects) {
    const mappedBens = projectMappings[proj.id] || [];
    await Project.create({
      name: proj.name,
      description: proj.description,
      beneficiaries: mappedBens,
      created_at: proj.created_at ? new Date(proj.created_at) : new Date()
    });
    console.log(`Uploaded project: ${proj.name} with ${mappedBens.length} beneficiaries.`);
  }

  sqliteDb.close();
  await mongoose.disconnect();
  console.log('All SQLite data migrated successfully to MongoDB Atlas.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
