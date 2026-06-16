const path = require('path');
// Load environment variables from the main project's backend .env file to reuse database and Drive keys
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });

const express = require('express');
const cors = require('cors');
const xlsx = require('xlsx');
const { google } = require('googleapis');
const { 
  User, 
  Beneficiary, 
  EnglishBeneficiary, 
  Project, 
  TranslationConfig, 
  normalizeArabicName 
} = require('./database');
const { runTranslationWorker } = require('./translate');

const app = express();
const PORT = process.env.PORT || 5005;

app.use(cors());
app.use(express.json());

// Google Drive Client Configuration
let driveClient = null;

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

function getOAuth2Client() {
  const clientId = cleanEnvVar(process.env.GOOGLE_OAUTH_CLIENT_ID);
  const clientSecret = cleanEnvVar(process.env.GOOGLE_OAUTH_CLIENT_SECRET);
  const redirectUri = 'http://localhost:5000/api/sync/oauth-callback';

  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function getDriveClient() {
  if (driveClient) return driveClient;
  try {
    const oauth2Client = getOAuth2Client();
    const refreshToken = cleanEnvVar(process.env.GOOGLE_OAUTH_REFRESH_TOKEN);

    if (!oauth2Client || !refreshToken) {
      console.warn('⚠️ Google Drive OAuth2 credentials missing from environment variables.');
      return null;
    }

    oauth2Client.setCredentials({ refresh_token: refreshToken });
    driveClient = google.drive({ version: 'v3', auth: oauth2Client });
    console.log('✅ Google Drive OAuth2 client configured successfully in SabaView');
    return driveClient;
  } catch (error) {
    console.error('❌ Failed to configure Google Drive client:', error);
    return null;
  }
}

// Start Translation Worker loop (every 12 hours)
setInterval(runTranslationWorker, 12 * 60 * 60 * 1000);
// Trigger initial run (wakes up and translates immediately on server startup/wake)
setTimeout(runTranslationWorker, 5000);

// --- APIs: Wakeup / Trigger Translation (Webhook for Cron Job) ---
app.get('/api/wakeup', async (req, res) => {
  try {
    console.log(`[WAKEUP] Wakeup request received at ${new Date().toISOString()}. Triggering translation worker...`);
    setImmediate(() => {
      runTranslationWorker();
    });
    res.json({
      success: true,
      message: 'SabaView server is awake. Translation worker triggered in the background.',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- APIs: Authentication ---
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
    }
    
    // Find user in database
    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, error: 'اسم المستخدم غير موجود' });
    }
    
    if (user.password !== password) {
      return res.status(401).json({ success: false, error: 'كلمة المرور غير صحيحة' });
    }
    
    return res.json({ 
      success: true, 
      user: { 
        id: user._id,
        username: user.username,
        name: user.name, 
        role: user.role 
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- APIs: User Management (Admin only) ---
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, name, password, role } = req.body;
  try {
    if (!username || !name || !password || !role) {
      return res.status(400).json({ success: false, error: 'جميع الحقول مطلوبة' });
    }
    
    const exists = await User.findOne({ username: username.trim().toLowerCase() });
    if (exists) {
      return res.status(400).json({ success: false, error: 'اسم المستخدم موجود بالفعل' });
    }
    
    const newUser = await User.create({
      username: username.trim().toLowerCase(),
      name: name.trim(),
      password: password,
      role: role
    });
    
    res.json({ 
      success: true, 
      user: { 
        id: newUser._id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role 
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
    }
    
    if (user.username === 'admin') {
      return res.status(400).json({ success: false, error: 'لا يمكن حذف حساب المدير الرئيسي' });
    }
    
    await User.findByIdAndDelete(id);
    res.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- APIs: Metadata ---
app.get('/api/metadata', async (req, res) => {
  try {
    const governorates = await Beneficiary.distinct('governorate');
    const districts = await Beneficiary.distinct('district');
    const delegates = await Beneficiary.distinct('delegate_name');
    
    const governoratesEn = await EnglishBeneficiary.distinct('governorate');
    const districtsEn = await EnglishBeneficiary.distinct('district');
    const delegatesEn = await EnglishBeneficiary.distinct('delegate_name');

    const projects = await Project.find({}, 'name');
    res.json({
      governorates: governorates.filter(Boolean),
      districts: districts.filter(Boolean),
      delegates: delegates.filter(Boolean),
      governoratesEn: governoratesEn.filter(Boolean),
      districtsEn: districtsEn.filter(Boolean),
      delegatesEn: delegatesEn.filter(Boolean),
      projects
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- APIs: Dashboard Stats ---
app.get('/api/dashboard-stats', async (req, res) => {
  const { lang } = req.query;
  try {
    const isEn = lang === 'en';
    const model = isEn ? EnglishBeneficiary : Beneficiary;
    
    const total = await model.countDocuments();
    const linked = await model.countDocuments({ card_status: { $in: ['linked', 'Linked'] } });
    const pending = await model.countDocuments({ card_status: { $in: ['pending', 'Pending'] } });
    const missing = await model.countDocuments({ card_status: { $in: ['missing', 'Missing'] } });
    const projects = await Project.countDocuments();

    res.json({ total, linked, pending, missing, projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- APIs: Fetch Arabic Beneficiaries ---
app.get('/api/beneficiaries', async (req, res) => {
  let { page = 1, limit = 100, search, governorate, district, region, delegate, card_status, project_id } = req.query;
  page = parseInt(page);
  limit = parseInt(limit);
  try {
    let filter = {};

    if (project_id) {
      const project = await Project.findById(project_id);
      if (project) {
        filter._id = { $in: project.beneficiaries.map(b => b.beneficiary_id) };
      } else {
        filter._id = { $in: [] };
      }
    }

    if (governorate) filter.governorate = governorate;
    if (district) filter.district = district;
    if (region) filter.region = region;
    if (delegate) filter.delegate_name = delegate;
    if (card_status) filter.card_status = card_status;

    if (search) {
      const normalizedSearch = normalizeArabicName(search);
      filter.$or = [
        { normalized_name: new RegExp(normalizedSearch, 'i') },
        { phone: new RegExp(search.trim(), 'i') },
        { id_number: new RegExp(search.trim(), 'i') },
        { code: new RegExp(search.trim(), 'i') },
        { name: new RegExp(search.trim(), 'i') }
      ];
    }

    const total = await Beneficiary.countDocuments(filter);
    const records = await Beneficiary.find(filter)
      .sort({ code: 1, created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      total,
      pages: Math.ceil(total / limit),
      page,
      records
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- APIs: Fetch English Beneficiaries ---
app.get('/api/beneficiaries-en', async (req, res) => {
  let { page = 1, limit = 100, search, governorate, district, region, delegate, card_status, project_id } = req.query;
  page = parseInt(page);
  limit = parseInt(limit);
  try {
    let filter = {};

    if (project_id) {
      const project = await Project.findById(project_id);
      if (project) {
        filter.arabic_beneficiary_id = { $in: project.beneficiaries.map(b => b.beneficiary_id) };
      } else {
        filter.arabic_beneficiary_id = { $in: [] };
      }
    }

    if (governorate) filter.governorate = governorate;
    if (district) filter.district = district;
    if (region) filter.region = new RegExp(region.trim(), 'i');
    if (delegate) filter.delegate_name = delegate;
    if (card_status) filter.card_status = card_status;

    if (search) {
      filter.$or = [
        { name: new RegExp(search.trim(), 'i') },
        { phone: new RegExp(search.trim(), 'i') },
        { id_number: new RegExp(search.trim(), 'i') },
        { code: new RegExp(search.trim(), 'i') },
        { occupation: new RegExp(search.trim(), 'i') }
      ];
    }

    const total = await EnglishBeneficiary.countDocuments(filter);
    const records = await EnglishBeneficiary.find(filter)
      .sort({ code: 1, created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      total,
      pages: Math.ceil(total / limit),
      page,
      records
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- APIs: Stream Card Images (Proxy Google Drive) ---
app.get('/api/cards/:id', async (req, res) => {
  const { id } = req.params;
  const mongoose = require('mongoose');
  try {
    let googleDriveFileId = id;

    // Check if the id is a valid mongoose ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      let ben = await Beneficiary.findById(id);
      if (!ben) {
        ben = await EnglishBeneficiary.findById(id);
      }
      if (ben && ben.googleDriveFileId) {
        googleDriveFileId = ben.googleDriveFileId;
      }
    }

    const drive = getDriveClient();
    if (!drive) {
      return res.status(500).json({ error: 'Google Drive client is not configured' });
    }

    const response = await drive.files.get(
      { fileId: googleDriveFileId, alt: 'media' },
      { responseType: 'stream' }
    );

    res.setHeader('Content-Type', response.headers['content-type'] || 'image/png');
    response.data.pipe(res);
  } catch (error) {
    console.error("Proxy download error:", error.message);
    res.status(404).json({ error: 'Image not found or access denied' });
  }
});

// --- APIs: Config & Settings (Admin only) ---
app.get('/api/config', async (req, res) => {
  try {
    const config = await TranslationConfig.findOne();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config', async (req, res) => {
  const { apiKey, provider, systemPrompt, dictionary, arabicViewerPassword, englishViewerPassword } = req.body;
  try {
    let config = await TranslationConfig.findOne();
    if (!config) config = new TranslationConfig();

    if (apiKey !== undefined) config.apiKey = apiKey;
    if (provider !== undefined) config.provider = provider;
    if (systemPrompt !== undefined) config.systemPrompt = systemPrompt;
    if (dictionary !== undefined) config.dictionary = dictionary;
    if (arabicViewerPassword !== undefined) config.arabicViewerPassword = arabicViewerPassword;
    if (englishViewerPassword !== undefined) config.englishViewerPassword = englishViewerPassword;

    await config.save();
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- APIs: Export Excel (Arabic) ---
app.get('/api/export/beneficiaries', async (req, res) => {
  const { ids, search, governorate, district, region, delegate, card_status, project_id } = req.query;
  try {
    let filter = {};
    if (project_id) {
      const project = await Project.findById(project_id);
      if (project) filter._id = { $in: project.beneficiaries.map(b => b.beneficiary_id) };
    }
    if (ids) {
      const idArray = ids.split(',').filter(id => id.trim() !== '');
      if (idArray.length > 0) filter._id = { $in: idArray };
    }
    if (governorate) filter.governorate = governorate;
    if (district) filter.district = district;
    if (region) filter.region = region;
    if (delegate) filter.delegate_name = delegate;
    if (card_status) filter.card_status = card_status;

    if (search) {
      const normalizedSearch = normalizeArabicName(search);
      filter.$or = [
        { normalized_name: new RegExp(normalizedSearch, 'i') },
        { phone: new RegExp(search.trim(), 'i') },
        { id_number: new RegExp(search.trim(), 'i') },
        { code: new RegExp(search.trim(), 'i') },
        { name: new RegExp(search.trim(), 'i') }
      ];
    }

    const rows = await Beneficiary.find(filter).sort({ code: 1 });

    const templatePath = path.join(__dirname, 'templates', 'arabic_template.xlsx');
    const workbook = xlsx.readFile(templatePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const range = xlsx.utils.decode_range(worksheet['!ref']);
    const startRowIndex = 2; // Row 3

    // Clear template data rows
    for (let r = startRowIndex; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = xlsx.utils.encode_cell({ r, c });
        if (worksheet[cellRef]) {
          worksheet[cellRef].v = '';
          worksheet[cellRef].t = 's';
        }
      }
    }

    // Populate data
    rows.forEach((r, idx) => {
      const rowIdx = startRowIndex + idx;
      const rowValues = [
        r.code || '',
        r.name || '',
        r.gender || '',
        r.birth_date || '',
        r.marital_status || '',
        r.id_type || '',
        r.id_number || '',
        r.occupation || '',
        r.partner_name || '',
        r.partner_gender || '',
        r.partner_id_type || '',
        r.partner_id_number || '',
        r.family_status || '',
        r.governorate || '',
        r.district || '',
        r.region || '',
        r.children_count || 0,
        r.adults_count || 0,
        r.elderly_count || 0,
        r.total_family_count || 0,
        r.phone || '',
        r.backup_phone || '',
        r.delegate_name || '',
        r.delegate_phone || '',
        r.survey_area || '',
        '', // Officer Name
        '', // Officer Phone
        r.notes || ''
      ];

      rowValues.forEach((val, c) => {
        const cellRef = xlsx.utils.encode_cell({ r: rowIdx, c });
        if (val !== undefined && val !== null) {
          if (worksheet[cellRef]) {
            worksheet[cellRef].v = val;
            worksheet[cellRef].t = typeof val === 'number' ? 'n' : 's';
          } else {
            worksheet[cellRef] = { t: typeof val === 'number' ? 'n' : 's', v: val };
          }
        }
      });
    });

    // Update range
    range.e.r = Math.max(startRowIndex + rows.length - 1, startRowIndex);
    worksheet['!ref'] = xlsx.utils.encode_range(range);

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=beneficiaries.xlsx');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- APIs: Export Excel (English) ---
app.get('/api/export/beneficiaries-en', async (req, res) => {
  const { ids, search, governorate, district, region, delegate, card_status, project_id } = req.query;
  try {
    let filter = {};
    if (project_id) {
      const project = await Project.findById(project_id);
      if (project) filter.arabic_beneficiary_id = { $in: project.beneficiaries.map(b => b.beneficiary_id) };
    }
    if (ids) {
      const idArray = ids.split(',').filter(id => id.trim() !== '');
      if (idArray.length > 0) filter._id = { $in: idArray };
    }
    if (governorate) filter.governorate = governorate;
    if (district) filter.district = district;
    if (region) filter.region = new RegExp(region.trim(), 'i');
    if (delegate) filter.delegate_name = delegate;
    if (card_status) filter.card_status = card_status;

    if (search) {
      filter.$or = [
        { name: new RegExp(search.trim(), 'i') },
        { phone: new RegExp(search.trim(), 'i') },
        { id_number: new RegExp(search.trim(), 'i') },
        { code: new RegExp(search.trim(), 'i') },
        { occupation: new RegExp(search.trim(), 'i') }
      ];
    }

    const rows = await EnglishBeneficiary.find(filter).sort({ code: 1 });

    const templatePath = path.join(__dirname, 'templates', 'english_template.xlsx');
    const workbook = xlsx.readFile(templatePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const range = xlsx.utils.decode_range(worksheet['!ref']);
    const startRowIndex = 2; // Row 3

    // Clear template data rows
    for (let r = startRowIndex; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = xlsx.utils.encode_cell({ r, c });
        if (worksheet[cellRef]) {
          worksheet[cellRef].v = '';
          worksheet[cellRef].t = 's';
        }
      }
    }

    // Populate data
    rows.forEach((r, idx) => {
      const rowIdx = startRowIndex + idx;
      const rowValues = [
        r.code || '',
        r.name || '',
        r.gender || '',
        r.birth_date || '',
        r.marital_status || '',
        r.id_type || '',
        r.id_number || '',
        r.occupation || '',
        r.partner_name || '',
        r.partner_gender || '',
        r.partner_id_type || '',
        r.partner_id_number || '',
        r.family_status || '',
        r.governorate || '',
        r.district || '',
        r.region || '',
        r.children_count || 0,
        r.adults_count || 0,
        r.elderly_count || 0,
        r.total_family_count || 0,
        r.phone || '',
        r.backup_phone || '',
        r.delegate_name || '',
        r.delegate_phone || '',
        r.survey_area || ''
      ];

      rowValues.forEach((val, c) => {
        const cellRef = xlsx.utils.encode_cell({ r: rowIdx, c });
        if (val !== undefined && val !== null) {
          if (worksheet[cellRef]) {
            worksheet[cellRef].v = val;
            worksheet[cellRef].t = typeof val === 'number' ? 'n' : 's';
          } else {
            worksheet[cellRef] = { t: typeof val === 'number' ? 'n' : 's', v: val };
          }
        }
      });
    });

    // Update range
    range.e.r = Math.max(startRowIndex + rows.length - 1, startRowIndex);
    worksheet['!ref'] = xlsx.utils.encode_range(range);

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=beneficiaries_en.xlsx');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- APIs: Export ZIP Cards from Google Drive ---
app.get('/api/export/zip-cards', async (req, res) => {
  const { ids, search, governorate, district, region, delegate, card_status, project_id } = req.query;
  try {
    let filter = { card_status: 'linked' };
    
    if (project_id) {
      const project = await Project.findById(project_id);
      if (project) filter._id = { $in: project.beneficiaries.map(b => b.beneficiary_id) };
    }
    if (ids) {
      const idArray = ids.split(',').filter(id => id.trim() !== '');
      if (idArray.length > 0) filter._id = { $in: idArray };
    }
    if (governorate) filter.governorate = governorate;
    if (district) filter.district = district;
    if (region) filter.region = region;
    if (delegate) filter.delegate_name = delegate;
    if (card_status) filter.card_status = card_status;

    if (search) {
      const normalizedSearch = normalizeArabicName(search);
      filter.$or = [
        { normalized_name: new RegExp(normalizedSearch, 'i') },
        { phone: new RegExp(search.trim(), 'i') },
        { id_number: new RegExp(search.trim(), 'i') },
        { code: new RegExp(search.trim(), 'i') },
        { name: new RegExp(search.trim(), 'i') }
      ];
    }

    const rows = await Beneficiary.find(filter).sort({ code: 1 });
    const linkedRows = rows.filter(r => r.googleDriveFileId);

    if (linkedRows.length === 0) {
      return res.status(404).send('لا توجد بطاقات مربوطة للتصدير.');
    }

    const drive = getDriveClient();
    if (!drive) {
      return res.status(500).send('Google Drive client is not configured.');
    }

    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=cards.zip');

    archive.pipe(res);

    for (const row of linkedRows) {
      try {
        const driveStream = await drive.files.get(
          { fileId: row.googleDriveFileId, alt: 'media' },
          { responseType: 'stream' }
        );
        const safeName = row.name.replace(/[\\/:*?"<>|]/g, '_');
        const filename = `${row.code || 'NO_CODE'}_${safeName}.png`;
        archive.append(driveStream.data, { name: filename });
      } catch (err) {
        console.error(`Failed to stream file ${row.googleDriveFileId} for ${row.name}:`, err.message);
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error("ZIP Export Error:", err);
    if (!res.headersSent) {
      res.status(500).send(err.message);
    }
  }
});

// --- APIs: Printable HTML Cards (Cards-Print) ---
app.get('/api/export/cards-print', async (req, res) => {
  const { ids, search, governorate, district, region, delegate, card_status, project_id, lang } = req.query;
  try {
    let filter = { card_status: 'linked' };
    let Model = Beneficiary;
    if (lang === 'en') {
      Model = EnglishBeneficiary;
    }

    if (project_id) {
      const project = await Project.findById(project_id);
      if (project) {
        if (lang === 'en') {
          filter.arabic_beneficiary_id = { $in: project.beneficiaries.map(b => b.beneficiary_id) };
        } else {
          filter._id = { $in: project.beneficiaries.map(b => b.beneficiary_id) };
        }
      }
    }

    if (ids) {
      const idArray = ids.split(',').filter(id => id.trim() !== '');
      if (idArray.length > 0) {
        if (lang === 'en') {
          filter._id = { $in: idArray };
        } else {
          filter._id = { $in: idArray };
        }
      }
    }

    if (governorate) filter.governorate = governorate;
    if (district) filter.district = district;
    if (region) filter.region = lang === 'en' ? new RegExp(region.trim(), 'i') : region;
    if (delegate) filter.delegate_name = delegate;
    if (card_status) filter.card_status = card_status;

    if (search) {
      if (lang === 'en') {
        filter.$or = [
          { name: new RegExp(search.trim(), 'i') },
          { phone: new RegExp(search.trim(), 'i') },
          { id_number: new RegExp(search.trim(), 'i') },
          { code: new RegExp(search.trim(), 'i') }
        ];
      } else {
        const normalizedSearch = normalizeArabicName(search);
        filter.$or = [
          { normalized_name: new RegExp(normalizedSearch, 'i') },
          { phone: new RegExp(search.trim(), 'i') },
          { id_number: new RegExp(search.trim(), 'i') },
          { code: new RegExp(search.trim(), 'i') },
          { name: new RegExp(search.trim(), 'i') }
        ];
      }
    }

    const rows = await Model.find(filter).sort({ code: 1 });
    const linkedCards = rows.filter(row => row.googleDriveFileId);

    if (linkedCards.length === 0) {
      return res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2>${lang === 'en' ? 'No linked cards found.' : 'لا توجد بطاقات مربوطة للمستفيدين المحددين.'}</h2>
            <button onclick="window.close()">${lang === 'en' ? 'Close' : 'إغلاق'}</button>
          </body>
        </html>
      `);
    }

    const cardsHtml = linkedCards.map(row => `
      <div class="card-page">
        <img class="card-image" src="/api/cards/${row.googleDriveFileId}" alt="${row.name}">
        <div class="card-info">
          <span>${lang === 'en' ? 'Name' : 'الاسم'}: ${row.name}</span> &nbsp;|&nbsp; 
          <span>${lang === 'en' ? 'Code' : 'كود'}: ${row.code || '—'}</span> &nbsp;|&nbsp; 
          <span>${lang === 'en' ? 'ID' : 'الهوية'}: ${row.id_number || '—'}</span>
        </div>
      </div>
    `).join('\n');

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${lang === 'en' ? 'Print Cards' : 'طباعة بطاقات المستفيدين'} (${linkedCards.length})</title>
          <style>
            body {
              font-family: sans-serif;
              background-color: #f1f5f9;
              padding: 20px;
              direction: ${lang === 'en' ? 'ltr' : 'rtl'};
              margin: 0;
            }
            @media print {
              body { background-color: #ffffff; padding: 0; }
              .no-print-bar { display: none !important; }
              .card-page { page-break-after: always; box-shadow: none !important; margin: 0 !important; border: none !important; }
            }
            .no-print-bar {
              background-color: #ffffff;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 12px 24px;
              max-width: 800px;
              margin: 0 auto 20px auto;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .btn-print {
              background-color: #0ea5e9;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 6px;
              font-weight: bold;
              cursor: pointer;
            }
            .btn-close {
              background-color: #e2e8f0;
              color: #334155;
              border: 1px solid #cbd5e1;
              padding: 8px 16px;
              border-radius: 6px;
              cursor: pointer;
            }
            .card-page {
              background: white;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto 20px auto;
              box-shadow: 0 1px 3px rgba(0,0,0,0.05);
              text-align: center;
            }
            .card-image {
              max-width: 100%;
              max-height: 500px;
              object-fit: contain;
            }
            .card-info {
              margin-top: 12px;
              font-size: 16px;
              font-weight: bold;
              color: #1e293b;
            }
          </style>
        </head>
        <body>
          <div class="no-print-bar">
            <span>${lang === 'en' ? 'Total Cards' : 'عدد البطاقات'}: ${linkedCards.length}</span>
            <div>
              <button class="btn-print" onclick="window.print()">${lang === 'en' ? 'Print' : 'طباعة'}</button>
              <button class="btn-close" onclick="window.close()">${lang === 'en' ? 'Close' : 'إغلاق'}</button>
            </div>
          </div>
          ${cardsHtml}
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Fallback: Serve compiled React static files (for Render deployment)
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SabaView Server running at http://localhost:${PORT}`);
});
