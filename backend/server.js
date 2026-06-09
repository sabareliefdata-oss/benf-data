require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { google } = require('googleapis');
const { Readable } = require('stream');
const cloudinary = require('cloudinary').v2;
const { 
  User, 
  Beneficiary, 
  Project, 
  checkDuplicateBeneficiary, 
  normalizeArabicName 
} = require('./database');

// Configure Cloudinary if URL is present
if (process.env.CLOUDINARY_URL) {
  cloudinary.config();
  console.log('☁️ Cloudinary configured successfully');
} else {
  console.warn('⚠️ CLOUDINARY_URL missing from environment variables');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure directories exist (for temporary PDF uploads and cards if any)
const uploadDir = path.join(__dirname, '..', 'uploads', 'cards');
const pdfDir = path.join(__dirname, '..', 'pdf_inputs');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

// Serve uploaded card images statically (fallback/legacy)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Serve frontend build static files in production
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// Configure Multer for file uploads (in-memory for Google Drive uploads)
const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({ storage: memoryStorage });

// Configure Multer for temporary excel upload
const excelUpload = multer({ dest: 'uploads/' });

// -------------------------------------------------------------
// Google Drive API Configuration
// -------------------------------------------------------------
let driveClient = null;

function getDriveClient() {
  if (driveClient) return driveClient;
  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    // Handle newline escaping in private key securely
    const privateKey = process.env.GOOGLE_PRIVATE_KEY 
      ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') 
      : null;

    if (!clientEmail || !privateKey) {
      console.warn('⚠️ Google Drive API credentials missing from environment variables. Running in local fallback.');
      return null;
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    driveClient = google.drive({ version: 'v3', auth });
    console.log('✅ Google Drive API client configured successfully');
    return driveClient;
  } catch (error) {
    console.error('❌ Failed to configure Google Drive client:', error);
    return null;
  }
}

// Helper to upload file buffer to Google Drive
async function uploadToGoogleDrive(fileBuffer, fileName, mimeType) {
  const drive = getDriveClient();
  if (!drive) {
    throw new Error('Google Drive API client is not configured.');
  }

  let folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (folderId && folderId.includes('/folders/')) {
    const match = folderId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (match) folderId = match[1];
  }
  const fileMetadata = {
    name: fileName,
    parents: folderId ? [folderId] : []
  };

  const media = {
    mimeType: mimeType,
    body: Readable.from(fileBuffer)
  };

  const response = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id'
  });

  return response.data.id;
}

// Helper to delete file from Google Drive
async function deleteFromGoogleDrive(fileId) {
  const drive = getDriveClient();
  if (!drive) return;
  try {
    await drive.files.delete({ fileId });
    console.log(`Deleted file ${fileId} from Google Drive`);
  } catch (error) {
    console.error(`Failed to delete file ${fileId} from Google Drive:`, error.message);
  }
}

// Helper to upload file buffer to Cloudinary
function uploadToCloudinary(fileBuffer, folder = 'benapp_cards') {
  return new Promise((resolve, reject) => {
    if (!process.env.CLOUDINARY_URL) {
      return reject(new Error('Cloudinary environment variable CLOUDINARY_URL is not configured.'));
    }
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'image'
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result); // result contains secure_url and public_id
      }
    );

    const stream = new Readable();
    stream.push(fileBuffer);
    stream.push(null);
    stream.pipe(uploadStream);
  });
}

// Helper to delete file from Cloudinary
async function deleteFromCloudinary(publicId) {
  if (!process.env.CLOUDINARY_URL || !publicId) return;
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`Deleted file ${publicId} from Cloudinary:`, result);
    return result;
  } catch (error) {
    console.error(`Failed to delete file ${publicId} from Cloudinary:`, error.message);
  }
}

// Helper function to extract a value from a row using multiple possible keys
function getValueByKeys(row, possibleKeys) {
  for (const k of possibleKeys) {
    if (row[k] !== undefined && row[k] !== null) {
      return row[k];
    }
  }
  
  const rowKeys = Object.keys(row);
  const normalize = (str) => {
    if (!str) return '';
    return String(str)
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة\b/g, "ه")
      .replace(/ى\b/g, "ي")
      .replace(/\s+/g, "");
  };

  const normalizedPossibleKeys = possibleKeys.map(normalize);

  for (const rk of rowKeys) {
    const normRk = normalize(rk);
    if (normalizedPossibleKeys.includes(normRk)) {
      return row[rk];
    }
  }

  return '';
}

// Helper function to auto-increment alphanumeric codes
function incrementAlphanumericCode(code) {
  if (!code) return '1001';
  const match = String(code).trim().match(/^(.*?)(\d+)$/);
  if (!match) {
    return String(code).trim() + '1';
  }
  const prefix = match[1];
  const digits = match[2];
  const nextNum = parseInt(digits, 10) + 1;
  const nextDigits = String(nextNum).padStart(digits.length, '0');
  return prefix + nextDigits;
}

// -------------------------------------------------------------
// APIs: General Settings & Helpers
// -------------------------------------------------------------

app.post('/api/log', (req, res) => {
  const { level, message, details } = req.body;
  console.log(`\x1b[36m[FRONTEND LOG - ${level.toUpperCase()}]\x1b[0m ${message}`);
  if (details) {
    console.log("Details:", typeof details === 'object' ? JSON.stringify(details, null, 2) : details);
  }
  res.json({ success: true });
});

app.get('/api/filters-data', async (req, res) => {
  try {
    const governorates = await Beneficiary.distinct('governorate', { governorate: { $ne: null, $ne: '' } });
    const districts = await Beneficiary.distinct('district', { district: { $ne: null, $ne: '' } });
    const regions = await Beneficiary.distinct('region', { region: { $ne: null, $ne: '' } });
    const delegates = await Beneficiary.distinct('delegate_name', { delegate_name: { $ne: null, $ne: '' } });

    res.json({
      governorates: governorates.sort(),
      districts: districts.sort(),
      regions: regions.sort(),
      delegates: delegates.sort()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve filter data', details: error.message });
  }
});

// -------------------------------------------------------------
// APIs: Beneficiaries CRUD
// -------------------------------------------------------------

// List Beneficiaries with advanced filtering & search
app.get('/api/beneficiaries', async (req, res) => {
  try {
    const { search, governorate, district, region, delegate, card_status, project_id, limit = 50, offset = 0 } = req.query;
    
    let filter = {};

    if (governorate) filter.governorate = governorate;
    if (district) filter.district = district;
    if (region) filter.region = region;
    if (delegate) filter.delegate_name = delegate;
    if (card_status) filter.card_status = card_status;

    if (search) {
      const normalizedSearch = normalizeArabicName(search);
      const searchRegex = new RegExp(search.trim(), 'i');
      const normSearchRegex = new RegExp(normalizedSearch, 'i');
      filter.$or = [
        { name: searchRegex },
        { normalized_name: normSearchRegex },
        { phone: searchRegex },
        { id_number: searchRegex },
        { code: searchRegex }
      ];
    }

    // Filter by project
    if (project_id) {
      const project = await Project.findById(project_id);
      if (project) {
        const beneficiaryIds = project.beneficiaries.map(b => b.beneficiary_id);
        filter._id = { $in: beneficiaryIds };
      } else {
        filter._id = { $in: [] };
      }
    }

    // Run count
    const totalCount = await Beneficiary.countDocuments(filter);
    res.setHeader('X-Total-Count', totalCount);
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');

    // Fetch sorted
    const rows = await Beneficiary.find(filter)
      .sort({ code: 1, _id: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve beneficiaries', details: error.message });
  }
});

// Check Duplicate (Live validation)
app.post('/api/beneficiaries/check-duplicate', async (req, res) => {
  const { name, phone, id_number, excludeId } = req.body;
  try {
    const duplicate = await checkDuplicateBeneficiary(name, phone, id_number, excludeId);
    res.json({ duplicate });
  } catch (error) {
    res.status(500).json({ error: 'Duplicate check failed', details: error.message });
  }
});

// Get Single Beneficiary
app.get('/api/beneficiaries/:id', async (req, res) => {
  try {
    const row = await Beneficiary.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Beneficiary not found' });
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch beneficiary', details: error.message });
  }
});

// Add Beneficiary
app.post('/api/beneficiaries', async (req, res) => {
  const { 
    code, name, gender, birth_date, marital_status, id_type, id_number, occupation,
    partner_name, partner_gender, partner_id_type, partner_id_number,
    family_status, governorate, district, region,
    children_count, adults_count, elderly_count, total_family_count,
    phone, backup_phone, delegate_name, delegate_phone, survey_area, notes,
    extra_data 
  } = req.body;
  
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const duplicate = await checkDuplicateBeneficiary(name, phone, id_number);
    if (duplicate) {
      return res.status(409).json({ 
        error: 'Duplicate detected', 
        type: duplicate.type, 
        existing: duplicate.record 
      });
    }

    let finalCode = code?.trim() || null;
    if (!finalCode) {
      const lastRow = await Beneficiary.findOne({ code: { $ne: null, $ne: "" } }).sort({ created_at: -1 });
      const lastCode = lastRow ? lastRow.code : '1000';
      finalCode = incrementAlphanumericCode(lastCode);
    }

    const normalized = normalizeArabicName(name);

    const result = await Beneficiary.create({
      code: finalCode,
      name: name.trim(),
      normalized_name: normalized,
      gender: gender?.trim() || null,
      birth_date: birth_date?.trim() || null,
      marital_status: marital_status?.trim() || null,
      id_type: id_type?.trim() || null,
      id_number: id_number?.trim() || null,
      occupation: occupation?.trim() || null,
      partner_name: partner_name?.trim() || null,
      partner_gender: partner_gender?.trim() || null,
      partner_id_type: partner_id_type?.trim() || null,
      partner_id_number: partner_id_number?.trim() || null,
      family_status: family_status?.trim() || null,
      governorate: governorate?.trim() || null,
      district: district?.trim() || null,
      region: region?.trim() || null,
      children_count: parseInt(children_count) || 0,
      adults_count: parseInt(adults_count) || 0,
      elderly_count: parseInt(elderly_count) || 0,
      total_family_count: parseInt(total_family_count) || 0,
      phone: phone?.trim() || null,
      backup_phone: backup_phone?.trim() || null,
      delegate_name: delegate_name?.trim() || null,
      delegate_phone: delegate_phone?.trim() || null,
      survey_area: survey_area?.trim() || null,
      notes: notes?.trim() || null,
      card_status: 'pending',
      extra_data: extra_data || {}
    });

    res.status(201).json({ id: result.id, message: 'Beneficiary added successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create beneficiary', details: error.message });
  }
});

// Edit Beneficiary
app.put('/api/beneficiaries/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    code, name, gender, birth_date, marital_status, id_type, id_number, occupation,
    partner_name, partner_gender, partner_id_type, partner_id_number,
    family_status, governorate, district, region,
    children_count, adults_count, elderly_count, total_family_count,
    phone, backup_phone, delegate_name, delegate_phone, survey_area, notes,
    card_status, extra_data 
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const duplicate = await checkDuplicateBeneficiary(name, phone, id_number, id);
    if (duplicate) {
      return res.status(409).json({ 
        error: 'Duplicate detected', 
        type: duplicate.type, 
        existing: duplicate.record 
      });
    }

    const current = await Beneficiary.findById(id);
    if (!current) return res.status(404).json({ error: 'Beneficiary not found' });

    let finalCardStatus = card_status || current.card_status;
    let finalCardImagePath = current.card_image_path;
    let finalGoogleDriveFileId = current.googleDriveFileId;
    let finalCloudinaryUrl = current.cloudinary_url;
    let finalCloudinaryPublicId = current.cloudinary_public_id;

    if (card_status === 'pending' || card_status === 'missing') {
      if (current.googleDriveFileId) {
        await deleteFromGoogleDrive(current.googleDriveFileId);
        finalGoogleDriveFileId = null;
      }
      if (current.cloudinary_public_id) {
        await deleteFromCloudinary(current.cloudinary_public_id);
        finalCloudinaryUrl = null;
        finalCloudinaryPublicId = null;
      }
      finalCardImagePath = null;
    }

    const normalized = normalizeArabicName(name);

    await Beneficiary.findByIdAndUpdate(id, {
      code: code?.trim() || null,
      name: name.trim(),
      normalized_name: normalized,
      gender: gender?.trim() || null,
      birth_date: birth_date?.trim() || null,
      marital_status: marital_status?.trim() || null,
      id_type: id_type?.trim() || null,
      id_number: id_number?.trim() || null,
      occupation: occupation?.trim() || null,
      partner_name: partner_name?.trim() || null,
      partner_gender: partner_gender?.trim() || null,
      partner_id_type: partner_id_type?.trim() || null,
      partner_id_number: partner_id_number?.trim() || null,
      family_status: family_status?.trim() || null,
      governorate: governorate?.trim() || null,
      district: district?.trim() || null,
      region: region?.trim() || null,
      children_count: parseInt(children_count) || 0,
      adults_count: parseInt(adults_count) || 0,
      elderly_count: parseInt(elderly_count) || 0,
      total_family_count: parseInt(total_family_count) || 0,
      phone: phone?.trim() || null,
      backup_phone: backup_phone?.trim() || null,
      delegate_name: delegate_name?.trim() || null,
      delegate_phone: delegate_phone?.trim() || null,
      survey_area: survey_area?.trim() || null,
      notes: notes?.trim() || null,
      card_status: finalCardStatus,
      card_image_path: finalCardImagePath,
      googleDriveFileId: finalGoogleDriveFileId,
      cloudinary_url: finalCloudinaryUrl,
      cloudinary_public_id: finalCloudinaryPublicId,
      extra_data: extra_data || {}
    });

    res.json({ message: 'Beneficiary updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update beneficiary', details: error.message });
  }
});

// Delete Beneficiary
app.delete('/api/beneficiaries/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const beneficiary = await Beneficiary.findById(id);
    if (!beneficiary) return res.status(404).json({ error: 'Beneficiary not found' });

    if (beneficiary.googleDriveFileId) {
      await deleteFromGoogleDrive(beneficiary.googleDriveFileId);
    }
    if (beneficiary.cloudinary_public_id) {
      await deleteFromCloudinary(beneficiary.cloudinary_public_id);
    }

    await Beneficiary.findByIdAndDelete(id);

    // Remove from projects
    await Project.updateMany(
      { 'beneficiaries.beneficiary_id': id },
      { $pull: { beneficiaries: { beneficiary_id: id } } }
    );

    res.json({ message: 'Beneficiary deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete beneficiary', details: error.message });
  }
});

// -------------------------------------------------------------
// APIs: Excel Import
// -------------------------------------------------------------

// Analyze Excel for duplicate warning before final import
app.post('/api/beneficiaries/import-analyze', excelUpload.single('file'), async (req, res) => {
  return res.status(403).json({ error: 'الاستيراد من إكسل غير مسموح به في النسخة السحابية. يرجى الاستيراد محلياً ومزامنة البيانات.' });

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet);

    const mappedRows = rows.map((row, index) => {
      const code = getValueByKeys(row, ['كود المستفيد', 'كود', 'Beneficiary Code', 'Code']);
      const name = getValueByKeys(row, ['اسم المستفيد بموجب البطاقة', 'الاسم بموجب البطاقة', 'اسم المستفيد', 'الاسم الكامل', 'الاسم', 'Name']);
      const gender = getValueByKeys(row, ['الجنس', 'النوع', 'Gender', 'Sex']);
      const birthDate = getValueByKeys(row, ['تاريخ الميلاد', 'تاريخ الولادة', 'Birth Date', 'DOB', 'Date of Birth']);
      const maritalStatus = getValueByKeys(row, ['الحالة الاجتماعية', 'الحالة الاجتماعيه', 'الحاله الاجتماعيه', 'Marital Status', 'Social Status']);
      const idType = getValueByKeys(row, ['نوع الهوية', 'نوع الهويه', 'نوع البطاقة', 'ID Type']);
      const idNumber = getValueByKeys(row, ['رقم الهوية', 'رقم البطاقة', 'رقم الهوية الوطنية', 'الرقم الوطني', 'National ID', 'ID Number', 'ID']);
      const occupation = getValueByKeys(row, ['المهنة', 'المهنه', 'العمل', 'الوظيفة', 'Occupation', 'Job']);
      const partnerName = getValueByKeys(row, ['اسم الشريك ( الزوج/ الزوجة)', 'اسم الشريك (الزوج/الزوجة)', 'اسم الشريك', 'الزوج', 'الزوجة', 'الزوج/الزوجة', 'Partner Name', 'Spouse Name']);
      const partnerGender = getValueByKeys(row, ['جنس الشريك', 'نوع الشريك', 'Partner Gender']);
      const partnerIdType = getValueByKeys(row, ['نوع هوية الشريك', 'نوع بطاقة الشريك', 'Partner ID Type']);
      const partnerIdNumber = getValueByKeys(row, ['رقم هوية الشريك', 'رقم بطاقة الشريك', 'Partner ID Number']);
      const familyStatus = getValueByKeys(row, ['حالة الأسرة', 'حالة الاسرة', 'حالة الاسره', 'الحالة الاجتماعية', 'Family Status', 'Status']);
      const governorate = getValueByKeys(row, ['المحافظة', 'المحافظه', 'Governorate']);
      const district = getValueByKeys(row, ['المديرية', 'المديريه', 'District']);
      const region = getValueByKeys(row, ['المنطقة', 'المنطقه', 'الحي', 'القرية', 'Region', 'Area']);
      const childrenCount = getValueByKeys(row, ['أطفال 1-18', 'اطفال 1-18', 'الاطفال', 'Children']);
      const adultsCount = getValueByKeys(row, ['بالغين 18-59', 'البالغين', 'Adults']);
      const elderlyCount = getValueByKeys(row, ['كبار +60', 'الكبار', 'Elderly']);
      const totalFamilyCount = getValueByKeys(row, ['اجمالي عدد افراد الاسرة', 'إجمالي عدد أفراد الأسرة', 'إجمالي عدد أفراد الاسرة', 'اجمالي عدد افراد اسرة', 'إجمالي أفراد الأسرة', 'الاجمالي', 'الإجمالي', 'Total Family Count', 'Total Family Members', 'Total Family Size', 'اجمالي افراد الاسرة']);
      const phone = getValueByKeys(row, ['رقم جوال المستفيد', 'جوال المستفيد', 'رقم الهاتف', 'رقم الجوال', 'هاتف المستفيد', 'Phone', 'Mobile']);
      const backupPhone = getValueByKeys(row, ['رقم الجوال الاحتياطي', 'جوال احتياطي', 'تلفون احتياطي', 'رقم آخر', 'Backup Phone', 'Secondary Phone']);
      const delegateName = getValueByKeys(row, ['اسم المندوب', 'المندوب', 'Delegate Name', 'Delegate']);
      const delegatePhone = getValueByKeys(row, ['رقم جوال المندوب', 'جوال المندوب', 'تلفون المندوب', 'Delegate Phone']);
      const surveyArea = getValueByKeys(row, ['منطقة المسح', 'موقع المسح', 'Survey Area']);
      const notes = getValueByKeys(row, ['ملاحظات', 'ملاحظة', 'ملاحظه', 'Notes', 'Note']);

      const extraData = {};
      const allMappedFields = [
        'كود المستفيد', 'كود', 'Beneficiary Code', 'Code',
        'اسم المستفيد بموجب البطاقة', 'الاسم بموجب البطاقة', 'اسم المستفيد', 'الاسم الكامل', 'الاسم', 'Name',
        'الجنس', 'النوع', 'Gender', 'Sex',
        'تاريخ الميلاد', 'تاريخ الولادة', 'Birth Date', 'DOB', 'Date of Birth',
        'الحالة الاجتماعية', 'الحالة الاجتماعيه', 'الحاله الاجتماعيه', 'Marital Status', 'Social Status',
        'نوع الهوية', 'نوع الهويه', 'نوع البطاقة', 'ID Type',
        'رقم الهوية', 'رقم البطاقة', 'رقم الهوية الوطنية', 'الرقم الوطني', 'National ID', 'ID Number', 'ID',
        'المهنة', 'المهنه', 'العمل', 'الوظيفة', 'Occupation', 'Job',
        'اسم الشريك ( الزوج/ الزوجة)', 'اسم الشريك (الزوج/الزوجة)', 'اسم الشريك', 'الزوج', 'الزوجة', 'الزوج/الزوجة', 'Partner Name', 'Spouse Name',
        'جنس الشريك', 'نوع الشريك', 'Partner Gender',
        'نوع هوية الشريك', 'نوع بطاقة الشريك', 'Partner ID Type',
        'رقم هوية الشريك', 'رقم بطاقة الشريك', 'Partner ID Number',
        'حالة الأسرة', 'حالة الاسرة', 'حالة الاسره', 'الحالة الاجتماعية', 'Family Status', 'Status',
        'المحافظة', 'المحافظه', 'Governorate',
        'المديرية', 'المديريه', 'District',
        'المنطقة', 'المنطقه', 'الحي', 'القرية', 'Region', 'Area',
        'أطفال 1-18', 'اطفال 1-18', 'الاطفال', 'Children',
        'بالغين 18-59', 'البالغين', 'Adults',
        'كبار +60', 'الكبار', 'Elderly',
        'اجمالي عدد افراد الاسرة', 'إجمالي عدد أفراد الأسرة', 'إجمالي عدد أفراد الاسرة', 'اجمالي عدد افراد اسرة', 'إجمالي أفراد الأسرة', 'الاجمالي', 'الإجمالي', 'Total Family Count', 'Total Family Members', 'Total Family Size', 'اجمالي افراد الاسرة',
        'رقم جوال المستفيد', 'جوال المستفيد', 'رقم الهاتف', 'رقم الجوال', 'هاتف المستفيد', 'Phone', 'Mobile',
        'رقم الجوال الاحتياطي', 'جوال احتياطي', 'تلفون احتياطي', 'رقم آخر', 'Backup Phone', 'Secondary Phone',
        'اسم المندوب', 'المندوب', 'Delegate Name', 'Delegate',
        'رقم جوال المندوب', 'جوال المندوب', 'تلفون المندوب', 'Delegate Phone',
        'منطقة المسح', 'موقع المسح', 'Survey Area',
        'ملاحظات', 'ملاحظة', 'ملاحظه', 'Notes', 'Note'
      ];
      
      const normalize = (str) => String(str).trim().toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة\b/g, "ه").replace(/ى\b/g, "ي").replace(/\s+/g, "");
      const normalizedMappedFields = allMappedFields.map(normalize);

      Object.keys(row).forEach(key => {
        const normKey = normalize(key);
        if (!normalizedMappedFields.includes(normKey)) {
          extraData[key] = row[key];
        }
      });

      return {
        rowNum: index + 2,
        code: code !== null && code !== undefined ? String(code).trim() : '',
        name: name !== null && name !== undefined ? String(name).trim() : '',
        gender: gender !== null && gender !== undefined ? String(gender).trim() : '',
        birth_date: birthDate !== null && birthDate !== undefined ? String(birthDate).trim() : '',
        marital_status: maritalStatus !== null && maritalStatus !== undefined ? String(maritalStatus).trim() : '',
        id_type: idType !== null && idType !== undefined ? String(idType).trim() : '',
        id_number: idNumber !== null && idNumber !== undefined ? String(idNumber).trim() : '',
        occupation: occupation !== null && occupation !== undefined ? String(occupation).trim() : '',
        partner_name: partnerName !== null && partnerName !== undefined ? String(partnerName).trim() : '',
        partner_gender: partnerGender !== null && partnerGender !== undefined ? String(partnerGender).trim() : '',
        partner_id_type: partnerIdType !== null && partnerIdType !== undefined ? String(partnerIdType).trim() : '',
        partner_id_number: partnerIdNumber !== null && partnerIdNumber !== undefined ? String(partnerIdNumber).trim() : '',
        family_status: family_status !== null && family_status !== undefined ? String(family_status).trim() : '',
        governorate: governorate !== null && governorate !== undefined ? String(governorate).trim() : '',
        district: district !== null && district !== undefined ? String(district).trim() : '',
        region: region !== null && region !== undefined ? String(region).trim() : '',
        children_count: parseInt(childrenCount) || 0,
        adults_count: parseInt(adultsCount) || 0,
        elderly_count: parseInt(elderlyCount) || 0,
        total_family_count: parseInt(totalFamilyCount) || 0,
        phone: phone !== null && phone !== undefined ? String(phone).trim() : '',
        backup_phone: backupPhone !== null && backupPhone !== undefined ? String(backupPhone).trim() : '',
        delegate_name: delegateName !== null && delegateName !== undefined ? String(delegateName).trim() : '',
        delegate_phone: delegatePhone !== null && delegatePhone !== undefined ? String(delegatePhone).trim() : '',
        survey_area: surveyArea !== null && surveyArea !== undefined ? String(surveyArea).trim() : '',
        notes: notes !== null && notes !== undefined ? String(notes).trim() : '',
        extra_data: extraData
      };
    });

    const analysis = {
      total: mappedRows.length,
      newItems: [],
      duplicates: []
    };

    for (const item of mappedRows) {
      if (!item.name) continue;
      
      const duplicate = await checkDuplicateBeneficiary(item.name, item.phone, item.id_number);
      if (duplicate) {
        analysis.duplicates.push({
          rowNum: item.rowNum,
          item,
          duplicateType: duplicate.type,
          existingRecord: duplicate.record
        });
      } else {
        analysis.newItems.push(item);
      }
    }

    fs.unlinkSync(req.file.path);
    res.json(analysis);
  } catch (error) {
    console.error("=== EXCEL IMPORT ANALYSIS ERROR ===");
    console.error(error);
    console.error("===================================");
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to analyze Excel file', details: error.message });
  }
});

// Final Excel Import Commit
app.post('/api/beneficiaries/import-commit', async (req, res) => {
  return res.status(403).json({ error: 'الاستيراد من إكسل غير مسموح به في النسخة السحابية. يرجى الاستيراد محلياً ومزامنة البيانات.' });
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  try {
    const lastRow = await Beneficiary.findOne({ code: { $ne: null, $ne: "" } }).sort({ created_at: -1 });
    let currentCode = lastRow ? lastRow.code : '1000';

    const insertItem = async (item) => {
      const normalized = normalizeArabicName(item.name);
      currentCode = incrementAlphanumericCode(currentCode);
      const finalCode = currentCode;

      await Beneficiary.create({
        code: finalCode,
        name: item.name,
        normalized_name: normalized,
        gender: item.gender || null,
        birth_date: item.birth_date || null,
        marital_status: item.marital_status || null,
        id_type: item.id_type || null,
        id_number: item.id_number || null,
        occupation: item.occupation || null,
        partner_name: item.partner_name || null,
        partner_gender: item.partner_gender || null,
        partner_id_type: item.partner_id_type || null,
        partner_id_number: item.partner_id_number || null,
        family_status: item.family_status || null,
        governorate: item.governorate || null,
        district: item.district || null,
        region: item.region || null,
        children_count: item.children_count || 0,
        adults_count: item.adults_count || 0,
        elderly_count: item.elderly_count || 0,
        total_family_count: item.total_family_count || 0,
        phone: item.phone || null,
        backup_phone: item.backup_phone || null,
        delegate_name: item.delegate_name || null,
        delegate_phone: item.delegate_phone || null,
        survey_area: item.survey_area || null,
        notes: item.notes || null,
        card_status: 'pending',
        extra_data: item.extra_data || {}
      });
    };

    const updateItem = async (item, id) => {
      const normalized = normalizeArabicName(item.name);
      await Beneficiary.findByIdAndUpdate(id, {
        code: item.code || null,
        name: item.name,
        normalized_name: normalized,
        gender: item.gender || null,
        birth_date: item.birth_date || null,
        marital_status: item.marital_status || null,
        id_type: item.id_type || null,
        id_number: item.id_number || null,
        occupation: item.occupation || null,
        partner_name: item.partner_name || null,
        partner_gender: item.partner_gender || null,
        partner_id_type: item.partner_id_type || null,
        partner_id_number: item.partner_id_number || null,
        family_status: item.family_status || null,
        governorate: item.governorate || null,
        district: item.district || null,
        region: item.region || null,
        children_count: item.children_count || 0,
        adults_count: item.adults_count || 0,
        elderly_count: item.elderly_count || 0,
        total_family_count: item.total_family_count || 0,
        phone: item.phone || null,
        backup_phone: item.backup_phone || null,
        delegate_name: item.delegate_name || null,
        delegate_phone: item.delegate_phone || null,
        survey_area: item.survey_area || null,
        notes: item.notes || null,
        extra_data: item.extra_data || {}
      });
    };

    if (newItems && Array.isArray(newItems)) {
      for (const item of newItems) {
        await insertItem(item);
        inserted++;
      }
    }

    if (duplicates && Array.isArray(duplicates)) {
      for (const d of duplicates) {
        const { item, action, existingRecord } = d;
        if (!item) continue;

        if (action === 'skip') {
          skipped++;
          continue;
        }

        if (action === 'force') {
          await insertItem(item);
          inserted++;
        } else if (action === 'update' && existingRecord) {
          await updateItem(item, existingRecord.id);
          updated++;
        }
      }
    }

    res.json({ success: true, inserted, updated, skipped });
  } catch (error) {
    console.error("=== IMPORT COMMIT ERROR ===");
    console.error(error);
    console.error("===========================");
    res.status(500).json({ error: 'Failed to commit import', details: error.message });
  }
});

// -------------------------------------------------------------
// APIs: Project Management
// -------------------------------------------------------------

app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort({ created_at: -1 });
    const processed = projects.map(p => {
      const json = p.toJSON();
      json.beneficiary_count = p.beneficiaries.length;
      return json;
    });
    res.json(processed);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve projects', details: error.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id).populate('beneficiaries.beneficiary_id');
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const beneficiaries = project.beneficiaries
      .filter(b => b.beneficiary_id !== null)
      .map(b => {
        const bJson = b.beneficiary_id.toJSON();
        bJson.project_status = b.status;
        return bJson;
      });

    res.json({ 
      project: { id: project.id, name: project.name, description: project.description, created_at: project.created_at }, 
      beneficiaries 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project details', details: error.message });
  }
});

app.post('/api/projects', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  try {
    const result = await Project.create({ name: name.trim(), description: description?.trim() || null, beneficiaries: [] });
    res.status(201).json({ id: result.id, message: 'Project created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project', details: error.message });
  }
});

// Get candidate beneficiaries for migration to project
app.get('/api/projects/:id/migration-candidates', async (req, res) => {
  const { id } = req.params;
  const { delegate, notes } = req.query;

  try {
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const linkedIds = project.beneficiaries.map(b => b.beneficiary_id);

    let filter = { _id: { $nin: linkedIds } };
    if (delegate) filter.delegate_name = delegate;
    if (notes) filter.notes = new RegExp(notes.trim(), 'i');

    const rows = await Beneficiary.find(filter, 'id code name delegate_name notes').sort({ code: 1, _id: -1 });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch migration candidates', details: error.message });
  }
});

app.post('/api/projects/:id/migrate', async (req, res) => {
  const { id } = req.params;
  const { governorate, district, region, delegate, card_status, ids } = req.body;

  try {
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const linkedIds = project.beneficiaries.map(b => b.beneficiary_id);

    let filter = { _id: { $nin: linkedIds } };

    if (ids && Array.isArray(ids)) {
      if (ids.length === 0) {
        return res.json({ migratedCount: 0, message: 'No IDs provided' });
      }
      filter._id = { $in: ids, $nin: linkedIds };
    } else {
      if (governorate) filter.governorate = governorate;
      if (district) filter.district = district;
      if (region) filter.region = region;
      if (delegate) filter.delegate_name = delegate;
      if (card_status) filter.card_status = card_status;
    }

    const eligible = await Beneficiary.find(filter, '_id');
    if (eligible.length === 0) {
      return res.json({ migratedCount: 0, message: 'No matching beneficiaries found' });
    }

    const newCandidates = eligible.map(e => ({ beneficiary_id: e._id, status: 'pending' }));
    
    await Project.findByIdAndUpdate(id, {
      $push: { beneficiaries: { $each: newCandidates } }
    });

    res.json({ migratedCount: eligible.length, message: `Successfully migrated ${eligible.length} beneficiaries to project.` });
  } catch (error) {
    res.status(500).json({ error: 'Migration failed', details: error.message });
  }
});

app.post('/api/projects/:id/beneficiary', async (req, res) => {
  const { id } = req.params;
  const { 
    code, name, gender, birth_date, marital_status, id_type, id_number, occupation,
    partner_name, partner_gender, partner_id_type, partner_id_number,
    family_status, governorate, district, region,
    children_count, adults_count, elderly_count, total_family_count,
    phone, backup_phone, delegate_name, delegate_phone, survey_area, notes
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    let beneficiaryId;
    const duplicate = await checkDuplicateBeneficiary(name, phone, id_number);

    if (duplicate) {
      beneficiaryId = duplicate.record.id;
      const exists = project.beneficiaries.some(b => b.beneficiary_id.toString() === beneficiaryId.toString());
      if (exists) {
        return res.status(409).json({ error: 'Beneficiary is already registered in this project' });
      }
    } else {
      let finalCode = code?.trim() || null;
      if (!finalCode) {
        const lastRow = await Beneficiary.findOne({ code: { $ne: null, $ne: "" } }).sort({ created_at: -1 });
        const lastCode = lastRow ? lastRow.code : '1000';
        finalCode = incrementAlphanumericCode(lastCode);
      }

      const normalized = normalizeArabicName(name);
      const newB = await Beneficiary.create({
        code: finalCode,
        name: name.trim(),
        normalized_name: normalized,
        gender: gender?.trim() || null,
        birth_date: birth_date?.trim() || null,
        marital_status: marital_status?.trim() || null,
        id_type: id_type?.trim() || null,
        id_number: id_number?.trim() || null,
        occupation: occupation?.trim() || null,
        partner_name: partner_name?.trim() || null,
        partner_gender: partner_gender?.trim() || null,
        partner_id_type: partner_id_type?.trim() || null,
        partner_id_number: partner_id_number?.trim() || null,
        family_status: family_status?.trim() || null,
        governorate: governorate?.trim() || null,
        district: district?.trim() || null,
        region: region?.trim() || null,
        children_count: parseInt(children_count) || 0,
        adults_count: parseInt(adults_count) || 0,
        elderly_count: parseInt(elderly_count) || 0,
        total_family_count: parseInt(total_family_count) || 0,
        phone: phone?.trim() || null,
        backup_phone: backup_phone?.trim() || null,
        delegate_name: delegate_name?.trim() || null,
        delegate_phone: delegate_phone?.trim() || null,
        survey_area: survey_area?.trim() || null,
        notes: notes?.trim() || null,
        card_status: 'pending'
      });
      beneficiaryId = newB._id;
    }

    await Project.findByIdAndUpdate(id, {
      $push: { beneficiaries: { beneficiary_id: beneficiaryId, status: 'pending' } }
    });

    res.status(201).json({ id: beneficiaryId, message: 'Beneficiary added and linked to project successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add project beneficiary', details: error.message });
  }
});

app.put('/api/projects/:projectId/beneficiaries/:beneficiaryId/status', async (req, res) => {
  const { projectId, beneficiaryId } = req.params;
  const { status } = req.body;
  try {
    await Project.updateOne(
      { _id: projectId, 'beneficiaries.beneficiary_id': beneficiaryId },
      { $set: { 'beneficiaries.$.status': status } }
    );
    res.json({ message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status', details: error.message });
  }
});

app.delete('/api/projects/:projectId/beneficiaries/:beneficiaryId', async (req, res) => {
  const { projectId, beneficiaryId } = req.params;
  try {
    await Project.updateOne(
      { _id: projectId },
      { $pull: { beneficiaries: { beneficiary_id: beneficiaryId } } }
    );
    res.json({ message: 'Beneficiary removed from project' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove beneficiary', details: error.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await Project.findByIdAndDelete(id);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project', details: error.message });
  }
});

// -------------------------------------------------------------
// APIs: PDF Operations (Local Files - Ephemeral in Production)
// -------------------------------------------------------------

app.get('/api/pdfs', (req, res) => {
  try {
    const files = fs.readdirSync(pdfDir);
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const pdfFiles = files.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return allowedExtensions.includes(ext);
    });
    res.json(pdfFiles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read PDF/Image directory', details: error.message });
  }
});

app.get('/api/pdfs/:filename', (req, res) => {
  const decodedFilename = decodeURIComponent(req.params.filename);
  const filePath = path.join(pdfDir, decodedFilename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    res.setHeader('Content-Type', 'application/pdf');
  } else if (ext === '.png') {
    res.setHeader('Content-Type', 'image/png');
  } else if (ext === '.jpg' || ext === '.jpeg') {
    res.setHeader('Content-Type', 'image/jpeg');
  } else if (ext === '.webp') {
    res.setHeader('Content-Type', 'image/webp');
  } else {
    res.setHeader('Content-Type', 'application/octet-stream');
  }
  
  fs.createReadStream(filePath).pipe(res);
});

const pdfUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, pdfDir);
    },
    filename: (req, file, cb) => {
      const utf8Name = Buffer.from(file.originalname, 'latin1').toString('utf8');
      cb(null, utf8Name);
    }
  })
});
app.post('/api/pdfs/upload', pdfUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ success: true, filename: req.file.filename });
});

// -------------------------------------------------------------
// APIs: Card Linking & Cropping (Google Drive Upload + Proxy Serving)
// -------------------------------------------------------------

app.post('/api/link-card', uploadMemory.single('image'), async (req, res) => {
  const { beneficiaryId } = req.body;
  if (!beneficiaryId) {
    return res.status(400).json({ error: 'beneficiaryId is required' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  try {
    const current = await Beneficiary.findById(beneficiaryId);
    if (!current) return res.status(404).json({ error: 'Beneficiary not found' });

    // Delete existing card from Google Drive if exists
    if (current.googleDriveFileId) {
      await deleteFromGoogleDrive(current.googleDriveFileId);
    }
    // Delete existing card from Cloudinary if exists
    if (current.cloudinary_public_id) {
      await deleteFromCloudinary(current.cloudinary_public_id);
    }

    // Upload cropped image directly to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(req.file.buffer);
    
    // Set relative path pointing to our proxy route with the beneficiary ID
    const relativePath = `/api/cards/${beneficiaryId}`;

    await Beneficiary.findByIdAndUpdate(beneficiaryId, {
      card_image_path: relativePath,
      cloudinary_url: cloudinaryResult.secure_url,
      cloudinary_public_id: cloudinaryResult.public_id,
      googleDriveFileId: null, // Clear Google Drive ID
      card_status: 'linked'
    });

    res.json({ success: true, card_image_path: relativePath });
  } catch (error) {
    console.error("Link card error:", error);
    res.status(500).json({ error: 'Failed to link card to beneficiary', details: error.message });
  }
});

// Proxy Serve card images directly from Cloudinary or Google Drive securely
app.get('/api/cards/:id', async (req, res) => {
  const { id } = req.params;
  const mongoose = require('mongoose');

  try {
    // 1. If the id is a valid Mongoose ID, get the beneficiary and stream their Cloudinary image
    if (mongoose.Types.ObjectId.isValid(id)) {
      const beneficiary = await Beneficiary.findById(id);
      if (beneficiary && beneficiary.cloudinary_url) {
        // Stream from Cloudinary URL instead of redirect to bypass geoblocking for end users
        const https = require('https');
        https.get(beneficiary.cloudinary_url, (cloudinaryRes) => {
          res.setHeader('Content-Type', cloudinaryRes.headers['content-type'] || 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
          cloudinaryRes.pipe(res);
        }).on('error', (err) => {
          console.error("Cloudinary streaming error:", err.message);
          res.status(500).json({ error: 'Failed to stream card image from Cloudinary' });
        });
        return;
      }
    }

    // 2. If it's not a valid Mongoose ID, search if a beneficiary has this id as googleDriveFileId
    // and has a Cloudinary image
    const beneficiary = await Beneficiary.findOne({ googleDriveFileId: id });
    if (beneficiary && beneficiary.cloudinary_url) {
      const https = require('https');
      https.get(beneficiary.cloudinary_url, (cloudinaryRes) => {
        res.setHeader('Content-Type', cloudinaryRes.headers['content-type'] || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        cloudinaryRes.pipe(res);
      }).on('error', (err) => {
        console.error("Cloudinary streaming error:", err.message);
        res.status(500).json({ error: 'Failed to stream card image from Cloudinary' });
      });
      return;
    }

    // 3. Fallback: stream from Google Drive for legacy files
    const drive = getDriveClient();
    if (!drive) {
      return res.status(500).json({ error: 'Google Drive client is not configured' });
    }

    const response = await drive.files.get(
      { fileId: id, alt: 'media' },
      { responseType: 'stream' }
    );

    res.setHeader('Content-Type', response.headers['content-type'] || 'image/png');
    response.data.pipe(res);
  } catch (error) {
    console.error("Proxy download error:", error.message);
    res.status(404).json({ error: 'Image not found or access denied' });
  }
});

// -------------------------------------------------------------
// APIs: Coordinator & Export Operations
// -------------------------------------------------------------

app.get('/api/export/cards-print', async (req, res) => {
  const { ids, search, governorate, district, region, delegate, card_status, project_id } = req.query;
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

    if (ids) {
      const idArray = ids.split(',').filter(id => id.trim() !== '');
      if (idArray.length > 0) {
        filter._id = { $in: idArray };
      }
    }

    if (governorate) filter.governorate = governorate;
    if (district) filter.district = district;
    if (region) filter.region = region;
    if (delegate) filter.delegate_name = delegate;
    if (card_status) filter.card_status = card_status;

    if (search) {
      const normalizedSearch = normalizeArabicName(search);
      const searchRegex = new RegExp(search.trim(), 'i');
      const normSearchRegex = new RegExp(normalizedSearch, 'i');
      filter.$or = [
        { name: searchRegex },
        { normalized_name: normSearchRegex },
        { phone: searchRegex },
        { id_number: searchRegex },
        { code: searchRegex }
      ];
    }

    const rows = await Beneficiary.find(filter).sort({ code: 1, _id: -1 });
    const linkedCards = rows.filter(row => row.card_image_path);
    
    if (linkedCards.length === 0) {
      return res.send(`
        <html>
          <head>
            <title>طباعة بطاقات المستفيدين</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
            <style>
              body { font-family: 'Cairo', sans-serif; text-align: center; padding: 50px; direction: rtl; }
            </style>
          </head>
          <body>
            <h2>تنبيه</h2>
            <p>لا توجد بطاقات مرتبطة للمستفيدين المحددين.</p>
            <button onclick="window.close()" style="padding: 8px 16px; font-family: 'Cairo'; cursor: pointer; border: 1px solid #cbd5e1; border-radius: 6px;">إغلاق النافذة</button>
          </body>
        </html>
      `);
    }

    // Generate absolute urls utilizing Render host or default
    const host = req.headers.host ? `http://${req.headers.host}` : 'http://localhost:5000';
    const cardsHtml = linkedCards.map(row => `
      <div class="card-page">
        <img class="card-image" src="${host}${row.card_image_path}" alt="${row.name}">
        <div class="card-info">
          <span>الاسم: ${row.name}</span> &nbsp;|&nbsp; 
          <span>كود: ${row.code || '—'}</span> &nbsp;|&nbsp; 
          <span>الهوية: ${row.id_number || '—'}</span>
        </div>
      </div>
    `).join('\n');

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>طباعة بطاقات المستفيدين (${linkedCards.length})</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Cairo', sans-serif;
              background-color: #f1f5f9;
              padding: 20px;
              direction: rtl;
              margin: 0;
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
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .btn-print {
              background-color: #0ea5e9;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 6px;
              font-size: 14px;
              font-weight: bold;
              cursor: pointer;
            }
            .btn-print:hover {
              background-color: #0284c7;
            }
            .btn-close {
              background-color: #e2e8f0;
              color: #334155;
              border: 1px solid #cbd5e1;
              padding: 8px 16px;
              border-radius: 6px;
              font-size: 14px;
              cursor: pointer;
            }
            .btn-close:hover {
              background-color: #cbd5e1;
            }
            .card-page {
              background: white;
              border: 1px solid #cbd5e1;
              border-radius: 12px;
              padding: 16px;
              margin-bottom: 20px;
              max-width: 700px;
              margin-left: auto;
              margin-right: auto;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
              text-align: center;
              page-break-inside: avoid;
            }
            .card-image {
              max-width: 100%;
              height: auto;
              border-radius: 6px;
              border: 1px solid #e2e8f0;
            }
            .card-info {
              margin-top: 12px;
              font-size: 15px;
              color: #1e293b;
              font-weight: bold;
              border-top: 1px dashed #cbd5e1;
              padding-top: 10px;
            }
            @media print {
              body { background-color: #ffffff; padding: 0; }
              .no-print-bar { display: none; }
              .card-page {
                border: none;
                box-shadow: none;
                margin: 0;
                padding: 0;
                height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                page-break-after: always;
              }
              .card-image {
                max-height: 90vh;
                max-width: 100%;
                object-fit: contain;
              }
            }
          </style>
        </head>
        <body>
          <div class="no-print-bar">
            <div>
              <strong>كشف طباعة بطاقات المستفيدين</strong>
              <span style="color: #64748b; font-size: 0.85rem; margin-right: 12px;">إجمالي البطاقات الجاهزة: ${linkedCards.length}</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn-print" onclick="window.print()">طباعة الكشف / حفظ PDF</button>
              <button class="btn-close" onclick="window.close()">إغلاق</button>
            </div>
          </div>
          ${cardsHtml}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send("فشل تجهيز كشف الطباعة: " + error.message);
  }
});

app.get('/api/export/beneficiaries', async (req, res) => {
  const { ids, search, governorate, district, region, delegate, card_status, project_id } = req.query;
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

    if (ids) {
      const idArray = ids.split(',').filter(id => id.trim() !== '');
      if (idArray.length > 0) {
        filter._id = { $in: idArray };
      }
    }

    if (governorate) filter.governorate = governorate;
    if (district) filter.district = district;
    if (region) filter.region = region;
    if (delegate) filter.delegate_name = delegate;
    if (card_status) filter.card_status = card_status;

    if (search) {
      const normalizedSearch = normalizeArabicName(search);
      const searchRegex = new RegExp(search.trim(), 'i');
      const normSearchRegex = new RegExp(normalizedSearch, 'i');
      filter.$or = [
        { name: searchRegex },
        { normalized_name: normSearchRegex },
        { phone: searchRegex },
        { id_number: searchRegex },
        { code: searchRegex }
      ];
    }

    const rows = await Beneficiary.find(filter).sort({ code: 1, _id: -1 });

    const data = rows.map(r => ({
      'كود المستفيد': r.code || '',
      'اسم المستفيد بموجب البطاقة': r.name,
      'الجنس': r.gender || '',
      'تاريخ الميلاد': r.birth_date || '',
      'الحالة الاجتماعية': r.marital_status || '',
      'نوع الهوية': r.id_type || '',
      'رقم الهوية': r.id_number || '',
      'المهنة': r.occupation || '',
      'اسم الشريك ( الزوج/ الزوجة)': r.partner_name || '',
      'جنس الشريك': r.partner_gender || '',
      'نوع هوية الشريك': r.partner_id_type || '',
      'رقم هوية الشريك': r.partner_id_number || '',
      'حالة الأسرة': r.family_status || '',
      'المحافظة': r.governorate || '',
      'المديرية': r.district || '',
      'المنطقة': r.region || '',
      'أطفال 1-18': r.children_count || 0,
      'بالغين 18-59': r.adults_count || 0,
      'كبار +60': r.elderly_count || 0,
      'إجمالي عدد أفراد الأسرة': r.total_family_count || 0,
      'رقم جوال المستفيد': r.phone || '',
      'رقم الجوال الاحتياطي': r.backup_phone || '',
      'اسم المندوب': r.delegate_name || '',
      'رقم جوال المندوب': r.delegate_phone || '',
      'منطقة المسح': r.survey_area || '',
      'ملاحظات': r.notes || '',
      'حالة البطاقة': r.card_status === 'linked' ? 'مربوطة' : r.card_status === 'missing' ? 'مفقودة' : 'معلقة'
    }));

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'المستفيدين');
    
    const buf = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename=beneficiaries_export.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (error) {
    res.status(500).json({ error: 'Export failed', details: error.message });
  }
});

app.get('/api/export/delegate-task', async (req, res) => {
  const { type, region, district, delegate } = req.query;
  try {
    let workbook = xlsx.utils.book_new();
    let filePrefix = 'delegate_task';

    if (type === 'exclude') {
      let filter = {};
      if (region) filter.region = region;
      if (district) filter.district = district;
      if (delegate) filter.delegate_name = delegate;

      const rows = await Beneficiary.find(filter, 'code name phone id_number governorate district region');
      const data = rows.map(r => ({
        'كود المستفيد': r.code || '',
        'الاسم الكامل بموجب البطاقة (موجود حالياً - لا تجمع له)': r.name,
        'رقم الهاتف': r.phone || '',
        'رقم الهوية': r.id_number || '',
        'المحافظة': r.governorate || '',
        'المديرية': r.district || '',
        'المنطقة': r.region || ''
      }));

      const sheet = xlsx.utils.json_to_sheet(data);
      xlsx.utils.book_append_sheet(workbook, sheet, 'مستبعدين من الجمع');
      filePrefix = `استبعاد_جمع_${region || 'عام'}`;

    } else if (type === 'update') {
      let filter = {
        $and: [
          {
            $or: [
              { card_status: { $in: ['pending', 'missing'] } },
              { phone: { $in: [null, ''] } },
              { id_number: { $in: [null, ''] } }
            ]
          }
        ]
      };
      
      if (region) filter.$and.push({ region: region });
      if (district) filter.$and.push({ district: district });
      if (delegate) filter.$and.push({ delegate_name: delegate });

      const rows = await Beneficiary.find(filter, 'id code name phone id_number governorate district region card_status');

      const data = rows.map(r => {
        let reasons = [];
        if (r.card_status !== 'linked') reasons.push('مفقود صورة البطاقة الشخصية');
        if (!r.phone) reasons.push('رقم الهاتف مفقود');
        if (!r.id_number) reasons.push('رقم الهوية مفقود');

        return {
          'معرف النظام (لا تغيره)': r.id,
          'كود المستفيد': r.code || '',
          'الاسم الكامل بموجب البطاقة': r.name,
          'رقم الهاتف الحالي': r.phone || '',
          'رقم الهوية الحالي': r.id_number || '',
          'المحافظة': r.governorate || '',
          'المديرية': r.district || '',
          'المنطقة': r.region || '',
          'الخلل المطلوب تحديثه': reasons.join(' - ')
        };
      });

      const sheet = xlsx.utils.json_to_sheet(data);
      xlsx.utils.book_append_sheet(workbook, sheet, 'بيانات وتحديثات مطلوبة');
      filePrefix = `تحديثات_ناقصة_${region || 'عام'}`;

    } else {
      const data = [
        {
          'كود المستفيد': '101',
          'اسم المستفيد بموجب البطاقة': 'محمد أحمد علي باوزير',
          'الجنس': 'ذكر',
          'تاريخ الميلاد': '1985-04-12',
          'الحالة الاجتماعية': 'متزوج',
          'نوع الهوية': 'بطاقة شخصية',
          'رقم الهوية': '105123456',
          'المهنة': 'كاسب/عامل',
          'اسم الشريك ( الزوج/ الزوجة)': 'فاطمة صالح عبدالله',
          'جنس الشريك': 'أنثى',
          'نوع هوية الشريك': 'بطاقة شخصية',
          'رقم هوية الشريك': '205123456',
          'حالة الأسرة': 'فقير',
          'المحافظة': 'عدن',
          'المديرية': 'المنصورة',
          'المنطقة': 'حي ريمي',
          'أطفال 1-18': '3',
          'بالغين 18-59': '2',
          'كبار +60': '0',
          'إجمالي عدد أفراد الأسرة': '5',
          'رقم جوال المستفيد': '777123456',
          'رقم الجوال الاحتياطي': '733123456',
          'اسم المندوب': delegate || 'أحمد صالح',
          'رقم جوال المندوب': '777000111',
          'منطقة المسح': region || 'المنصورة',
          'ملاحظات': 'يحتاج مساعدة طبية'
        }
      ];
      const sheet = xlsx.utils.json_to_sheet(data);
      xlsx.utils.book_append_sheet(workbook, sheet, 'كشف جمع جديد');
      filePrefix = `كشف_جمع_جديد_${region || 'عام'}`;
    }

    const buf = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filePrefix)}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);

  } catch (error) {
    res.status(500).json({ error: 'Failed to generate delegate task sheet', details: error.message });
  }
});

// -------------------------------------------------------------
// APIs: Maintenance & Data Management (MongoDB Atlas)
// -------------------------------------------------------------

// Get all projects for a specific beneficiary
app.get('/api/beneficiaries/:id/projects', async (req, res) => {
  const { id } = req.params;
  try {
    const projects = await Project.find({ 'beneficiaries.beneficiary_id': id }, 'id name description created_at');
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch beneficiary projects', details: error.message });
  }
});

// Unify multiple delegates under a single target name
app.post('/api/maintenance/unify-delegates', async (req, res) => {
  const { sourceNames, targetName } = req.body;
  if (!sourceNames || !Array.isArray(sourceNames) || sourceNames.length === 0 || !targetName) {
    return res.status(400).json({ error: 'Invalid input. Provide sourceNames as array and targetName as string.' });
  }
  try {
    const targetDelegate = await Beneficiary.findOne({ 
      delegate_name: targetName, 
      delegate_phone: { $ne: null, $ne: "" } 
    });
    const targetPhone = targetDelegate ? targetDelegate.delegate_phone : null;

    let updateData = { delegate_name: targetName };
    if (targetPhone) {
      updateData.delegate_phone = targetPhone;
    }

    const result = await Beneficiary.updateMany(
      { delegate_name: { $in: sourceNames } },
      { $set: updateData }
    );

    res.json({ success: true, changes: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unify delegates', details: error.message });
  }
});

// Clear notes bulk (globally or per-project)
app.post('/api/maintenance/clear-notes', async (req, res) => {
  const { projectId } = req.body;
  try {
    let result;
    if (projectId) {
      const project = await Project.findById(projectId);
      if (project) {
        const beneficiaryIds = project.beneficiaries.map(b => b.beneficiary_id);
        result = await Beneficiary.updateMany(
          { _id: { $in: beneficiaryIds } },
          { $set: { notes: null } }
        );
      } else {
        return res.status(404).json({ error: 'Project not found' });
      }
    } else {
      result = await Beneficiary.updateMany({}, { $set: { notes: null } });
    }
    res.json({ success: true, changes: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear notes', details: error.message });
  }
});

// -------------------------------------------------------------
// APIs: User Management & Authentication (MongoDB Atlas)
// -------------------------------------------------------------

// Login endpoint (password-only authentication)
app.post('/api/auth/login', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'الرجاء إدخال كلمة المرور' });
  }
  try {
    const user = await User.findOne({ password: password.trim() });
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to authenticate', details: error.message });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ created_at: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve users', details: error.message });
  }
});

// Create new user
app.post('/api/users', async (req, res) => {
  const { name, password, role } = req.body;
  if (!name || !password || !role) {
    return res.status(400).json({ error: 'الرجاء إدخال جميع الحقول (الاسم، الباسورد، الدور)' });
  }
  try {
    const exists = await User.findOne({ password: password.trim() });
    if (exists) {
      return res.status(400).json({ error: 'كلمة المرور هذه مستخدمة بالفعل لحساب آخر، الرجاء اختيار كلمة مرور فريدة' });
    }
    
    const result = await User.create({
      name: name.trim(),
      password: password.trim(),
      role: role
    });
    res.json({ success: true, id: result.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user', details: error.message });
  }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, password, role } = req.body;
  if (!name || !password || !role) {
    return res.status(400).json({ error: 'الرجاء إدخال جميع الحقول' });
  }
  try {
    const exists = await User.findOne({ password: password.trim(), _id: { $ne: id } });
    if (exists) {
      return res.status(400).json({ error: 'كلمة المرور هذه مستخدمة بالفعل لحساب آخر، الرجاء اختيار كلمة مرور فريدة' });
    }
    
    await User.findByIdAndUpdate(id, {
      name: name.trim(),
      password: password.trim(),
      role: role
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user', details: error.message });
  }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (user && user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'لا يمكن حذف حساب المدير الأخير، يجب إبقاء حساب مدير واحد على الأقل بالنظام.' });
      }
    }
    
    await User.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user', details: error.message });
  }
});

// Multer config for temporary logo storage
const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, pdfDir);
    },
    filename: (req, file, cb) => {
      cb(null, 'temp_logo.png');
    }
  })
});

// Upload system logo
app.post('/api/maintenance/upload-logo', logoUpload.single('logo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'لم يتم رفع ملف الشعار' });
  }
  try {
    const tempPath = req.file.path;
    const publicLogoPath = path.join(__dirname, '..', 'frontend', 'public', 'logo.png');
    const distLogoPath = path.join(__dirname, '..', 'frontend', 'dist', 'logo.png');

    fs.copyFileSync(tempPath, publicLogoPath);
    if (fs.existsSync(path.dirname(distLogoPath))) {
      fs.copyFileSync(tempPath, distLogoPath);
    }
    fs.unlinkSync(tempPath);

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to save logo:", error);
    res.status(500).json({ error: 'فشل حفظ ملف الشعار على القرص', details: error.message });
  }
});

// Get dashboard statistics (optimized direct counts)
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const total = await Beneficiary.countDocuments();
    const linked = await Beneficiary.countDocuments({ card_status: 'linked' });
    const pending = await Beneficiary.countDocuments({ card_status: 'pending' });
    const missing = await Beneficiary.countDocuments({ card_status: 'missing' });
    const projects = await Project.countDocuments();

    res.json({
      total,
      linked,
      pending,
      missing,
      projects
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: 'Failed to retrieve stats', details: error.message });
  }
});

// Fallback in production: serve React app if exists, otherwise return API status message
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('Benapp API Server is running successfully.');
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
  console.log(`Open folder pdf_inputs to place PDF files.`);
  console.log(`Open folder uploads/cards to see linked cards.`);
});
