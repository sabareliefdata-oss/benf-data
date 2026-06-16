const { Beneficiary, EnglishBeneficiary, TranslationConfig } = require('./database');

// Translate static dictionary fields
function translateWithDict(text, dictionary) {
  if (!text) return '';
  const trimmed = String(text).trim();
  if (dictionary && (dictionary.get ? dictionary.get(trimmed) : dictionary[trimmed])) {
    return dictionary.get ? dictionary.get(trimmed) : dictionary[trimmed];
  }
  
  // Standard default mappings in case dictionary is not populated yet
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

// Call AI API to translate text fields
async function translateWithAI(record, config) {
  const apiKey = config.apiKey;
  const provider = config.provider || 'gemini';

  const inputData = {
    name: record.name || '',
    partner_name: record.partner_name || '',
    governorate: record.governorate || '',
    district: record.district || '',
    region: record.region || '',
    delegate_name: record.delegate_name || '',
    survey_area: record.survey_area || '',
    gender: record.gender || '',
    partner_gender: record.partner_gender || '',
    marital_status: record.marital_status || '',
    id_type: record.id_type || '',
    partner_id_type: record.partner_id_type || '',
    occupation: record.occupation || '',
    family_status: record.family_status || '',
    notes: record.notes || ''
  };

  const prompt = `You are an expert translator of Arabic proper names and beneficiary records into English.
Your task is to translate and transliterate the fields in the provided JSON object.

Follow these strict rules:

1. PHONETIC TRANSLITERATION (Transcribing proper names into English spelling based on sounds, not meanings):
   - Applied to fields: "name", "partner_name", "governorate", "district", "region", "delegate_name", "survey_area".
   - Use the most common English spelling that reflects Yemeni Arabic pronunciation.
   - Handle "الـ" as "Al-" (e.g., "الذبياني" -> "Al-Dhubhani", "الهوذلي" -> "Al-Houthali").
   - Preserve "Abduh", "Abdul", "Abu", "Mohammed", "Ahmed", etc.
   - Keep original spaces (e.g., "عبد المجيد" -> "Abdul Majeed", "عبدالواسع" -> "Abdul Wasea").
   - Transcribe names in the order given: [First] [Father] [Grandfather] [Surname].
   - If any name field is just a dash "-", you MUST return "-" in the output.

2. SEMANTIC TRANSLATION (Translating meanings of fields into standard English terms):
   - Applied to fields: "gender", "partner_gender", "marital_status", "id_type", "partner_id_type", "occupation", "family_status", "notes".
   
   - "gender" / "partner_gender" Mapping:
     * "ذكر" -> "Male"
     * "أنثى" -> "Female"
     * If empty or unknown -> "" or "—"
     
   - "marital_status" Mapping:
     * Map all variations of "متزوج" or "متزوجة" -> "Married"
     * Map all variations of "أعزب", "اعزب", "عازب", "عازبة" -> "Single"
     * Map all variations of "مطلق", "مطلقة", "مطلقه", "متطلقة" -> "Divorced"
     * Map all variations of "أرمل", "ارمل", "أرملة", "ارملة", "ارمال" -> "Widowed"
     
   - "id_type" / "partner_id_type" Mapping:
     * Map all variations of "البطاقة الشخصية", "بطاقة شخصية", "ذكية", "الكترونية" -> "National ID"
     * Map all variations of "جواز السفر", "جواز", "جواز سفر" -> "Passport"
     * Map all variations of "بطاقة عائلية", "عائلية" -> "Family ID"
     * Map all variations of "بطاقة جامعية", "بطاقة طالب", "رقم جلوس" -> "Student ID"
     * Map all variations of "بطاقة انتخابية", "انتخابية", "انتخابيه" -> "Voter ID"
     * Map all variations of "عقد زواج", "عقد الزواج" -> "Marriage Contract"
     
   - "occupation" Mapping:
     * Simplify and translate to standard English occupation terms. Combine similar concepts:
       - "مدرس" or "أستاذ" or "معلم" -> "Teacher"
       - "عامل" or "عمالة" -> "Worker"
       - "كهربائي" or "فني كهرباء" or "عامل كهرباء" -> "Electrician"
       - If no occupation / unemployed -> "Unemployed" or "None"
       
   - "family_status" Mapping:
     * Deduce the socio-economic meaning:
       - "فقير" -> "Poor"
       - "معدم" -> "Destitute"
       - "معاق" -> "Disabled"
       - "يتيم" or "أيتام" or "يتامى" -> "Orphan"
       - "نازح" -> "Displaced"
       - "مريض" -> "Sick"
       
   - "notes":
     * Translate the general meaning of any notes into English.

Input JSON:
${JSON.stringify(inputData, null, 2)}

You MUST return the translation EXACTLY as a JSON object matching this structure:
{
  "name": "transliterated name",
  "partner_name": "transliterated partner name",
  "governorate": "transliterated governorate",
  "district": "transliterated district",
  "region": "transliterated region",
  "delegate_name": "transliterated delegate name",
  "survey_area": "transliterated survey area",
  "gender": "translated gender",
  "partner_gender": "translated partner gender",
  "marital_status": "translated marital status",
  "id_type": "translated id type",
  "partner_id_type": "translated partner id type",
  "occupation": "translated occupation",
  "family_status": "translated family status",
  "notes": "translated notes"
}

Return ONLY the raw JSON object. Do not wrap in markdown \`\`\`json or add any explanations.`;

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Invalid response structure from Gemini API");

    // Clean markdown code blocks if AI wrapped it
    text = text.replace(/```json/i, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } else if (provider === 'openai') {
    const url = 'https://api.openai.com/v1/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Invalid response structure from OpenAI API");
    return JSON.parse(text);
  } else {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

// Main translation logic for a single record
async function translateRecord(record, config) {
  try {
    // 1. Check if API key is configured
    if (!config.apiKey || config.apiKey.trim() === '') {
      console.warn(`[SKIP] No translation API key configured. Skipping record: ${record.name} (Code: ${record.code})`);
      return;
    }

    // Define fields that require translation (monitored fields)
    const monitoredFields = [
      'name', 'partner_name', 'governorate', 'district', 'region', 
      'delegate_name', 'survey_area', 'gender', 'partner_gender', 
      'marital_status', 'id_type', 'partner_id_type', 'occupation', 
      'family_status', 'notes'
    ];

    // 2. Check if translation already exists
    const exists = await EnglishBeneficiary.findOne({ arabic_beneficiary_id: record._id });

    let translationNeeded = true;
    let ai = null;

    if (exists) {
      translationNeeded = false;
      const lastTranslated = exists.last_translated_arabic_data || new Map();
      for (const field of monitoredFields) {
        const oldVal = lastTranslated.get ? lastTranslated.get(field) : lastTranslated[field];
        const newVal = record[field];
        // Normalize comparison (undefined/null vs empty string)
        if ((oldVal || '') !== (newVal || '')) {
          translationNeeded = true;
          break;
        }
      }
    }

    if (translationNeeded) {
      console.log(`Translating beneficiary (AI translation needed): ${record.name} (Code: ${record.code})`);
      // 3. Call AI API to translate the record
      try {
        ai = await translateWithAI(record, config);
      } catch (aiErr) {
        console.error(`[SKIP] AI Translation failed for record ${record.code}. Record skipped to avoid clutter. Error:`, aiErr.message);
        throw aiErr; // Rethrow so worker can catch and handle rate limit / quota exhaustion
      }

      if (!ai) {
        console.error(`[SKIP] AI returned empty translation for record ${record.code}. Record skipped.`);
        return;
      }
    } else {
      console.log(`[OPTIMIZED] No text fields changed for: ${record.name} (Code: ${record.code}). Direct copy updating.`);
    }

    const dict = config.dictionary;
    const cardStatus = translateWithDict(record.card_status, dict);

    // Prepare last_translated_arabic_data
    const lastTranslatedData = {};
    for (const field of monitoredFields) {
      lastTranslatedData[field] = record[field] || '';
    }

    // 4. Save or update the English record
    if (exists) {
      if (translationNeeded) {
        // Update existing record with the new translations
        exists.name = ai.name || record.name;
        exists.gender = ai.gender || '';
        exists.marital_status = ai.marital_status || '';
        exists.id_type = ai.id_type || '';
        exists.occupation = ai.occupation || '';
        exists.partner_name = ai.partner_name || '';
        exists.partner_gender = ai.partner_gender || '';
        exists.partner_id_type = ai.partner_id_type || '';
        exists.family_status = ai.family_status || '';
        exists.governorate = ai.governorate || '';
        exists.district = ai.district || '';
        exists.region = ai.region || '';
        exists.delegate_name = ai.delegate_name || '';
        exists.survey_area = ai.survey_area || '';
        exists.notes = ai.notes || '';
        exists.last_translated_arabic_data = lastTranslatedData;
      }

      // Always update direct/copied fields
      exists.code = record.code;
      exists.birth_date = record.birth_date;
      exists.id_number = record.id_number;
      exists.partner_id_number = record.partner_id_number;
      exists.children_count = record.children_count;
      exists.adults_count = record.adults_count;
      exists.elderly_count = record.elderly_count;
      exists.total_family_count = record.total_family_count;
      exists.phone = record.phone;
      exists.backup_phone = record.backup_phone;
      exists.delegate_phone = record.delegate_phone;
      exists.card_status = cardStatus;
      exists.googleDriveFileId = record.googleDriveFileId;
      
      await exists.save();
      console.log(`Successfully updated English translation for: ${record.name}`);
    } else {
      // Create new record
      await EnglishBeneficiary.create({
        arabic_beneficiary_id: record._id,
        code: record.code,
        name: ai.name || record.name,
        gender: ai.gender || '',
        birth_date: record.birth_date,
        marital_status: ai.marital_status || '',
        id_type: ai.id_type || '',
        id_number: record.id_number,
        occupation: ai.occupation || '',
        partner_name: ai.partner_name || '',
        partner_gender: ai.partner_gender || '',
        partner_id_type: ai.partner_id_type || '',
        partner_id_number: record.partner_id_number,
        family_status: ai.family_status || '',
        governorate: ai.governorate || '',
        district: ai.district || '',
        region: ai.region || '',
        children_count: record.children_count,
        adults_count: record.adults_count,
        elderly_count: record.elderly_count,
        total_family_count: record.total_family_count,
        phone: record.phone,
        backup_phone: record.backup_phone,
        delegate_name: ai.delegate_name || '',
        delegate_phone: record.delegate_phone,
        survey_area: ai.survey_area || '',
        notes: ai.notes || '',
        card_status: cardStatus,
        googleDriveFileId: record.googleDriveFileId,
        last_translated_arabic_data: lastTranslatedData,
        created_at: record.created_at
      });
      console.log(`Successfully translated and saved new English record for: ${record.name}`);
    }
  } catch (err) {
    console.error(`Error in translateRecord for ${record.code}:`, err);
  }
}

// Background Translation Worker
let isTranslationWorkerRunning = false;

async function runTranslationWorker() {
  if (isTranslationWorkerRunning) {
    console.log("Translation worker is already running. Skipping execution.");
    return;
  }
  isTranslationWorkerRunning = true;
  try {
    const config = await TranslationConfig.findOne();
    if (!config || !config.apiKey || config.apiKey.trim() === '') {
      // Silently return if no API key is set to avoid flooding logs
      return;
    }

    console.log("Translation worker started. Checking for untranslated or outdated records...");

    let hasMore = true;
    let totalProcessed = 0;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    while (hasMore) {
      // Find beneficiaries that do not have a translation yet OR whose critical fields or timestamps differ
      const untranslated = await Beneficiary.aggregate([
        {
          $lookup: {
            from: 'englishbeneficiaries',
            localField: '_id',
            foreignField: 'arabic_beneficiary_id',
            as: 'translation'
          }
        },
        {
          $match: {
            $or: [
              { translation: { $size: 0 } }, // No translation exists
              {
                $expr: {
                  $or: [
                    // 1. Google Drive File ID mismatch
                    {
                      $ne: [
                        { $ifNull: ['$googleDriveFileId', ''] },
                        { $ifNull: [{ $arrayElemAt: ['$translation.googleDriveFileId', 0] }, ''] }
                      ]
                    },
                    // 2. Card Status mismatch
                    {
                      $ne: [
                        { $ifNull: ['$card_status', ''] },
                        { $ifNull: [{ $arrayElemAt: ['$translation.card_status', 0] }, ''] }
                      ]
                    },
                    // 3. Phone number mismatch
                    {
                      $ne: [
                        { $ifNull: ['$phone', ''] },
                        { $ifNull: [{ $arrayElemAt: ['$translation.phone', 0] }, ''] }
                      ]
                    },
                    // 4. Timestamp check (if timestamps exist on the Arabic record)
                    {
                      $and: [
                        { $ne: ['$updated_at', null] },
                        {
                          $gt: [
                            { $ifNull: ['$updated_at', '$created_at'] },
                            { $ifNull: [{ $arrayElemAt: ['$translation.updated_at', 0] }, { $arrayElemAt: ['$translation.created_at', 0] }, new Date(0)] }
                          ]
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          }
        },
        { $limit: 10 } // Process in batches of 10
      ]);

      if (untranslated.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`Translation worker found ${untranslated.length} records in this batch. Processing...`);

      for (const ben of untranslated) {
        let success = false;
        let retries = 0;
        const maxRetries = 3;

        while (!success && retries < maxRetries) {
          try {
            await translateRecord(ben, config);
            success = true;
            totalProcessed++;
            // A small polite delay between requests (e.g. 200ms) under normal conditions
            await sleep(200);
          } catch (err) {
            // Check if it's a rate limit / quota error (status 429)
            const isRateLimit = err.message.includes('429') || err.message.toLowerCase().includes('resource exhausted') || err.message.toLowerCase().includes('too many requests');
            
            if (isRateLimit) {
              retries++;
              const errMsg = err.message.toLowerCase();
              
              if (errMsg.includes('daily') || errMsg.includes('per day') || errMsg.includes('limit exceeded')) {
                console.warn(`[LIMIT] Daily API limit reached for Gemini. Stopping translation worker for today.`);
                hasMore = false;
                return; // Exit worker completely
              } else {
                // Minute limit: wait and retry
                console.warn(`[WARNING] Gemini rate limit hit (429). Retrying record ${ben.code} in 15 seconds... (Attempt ${retries}/${maxRetries})`);
                await sleep(15000); // Sleep for 15 seconds
              }
            } else {
              // General non-rate-limit error (e.g., parsing error, database error)
              console.error(`Error translating record ${ben.code}:`, err.message);
              // Break retry loop so we don't retry non-transient errors
              break; 
            }
          }
        }

        // If we failed after max retries due to rate limit, let's stop the worker to be safe
        if (!success) {
          console.warn(`Failed to translate record ${ben.code} after ${maxRetries} attempts. Stopping current worker run.`);
          hasMore = false;
          break;
        }
      }
    }

    if (totalProcessed > 0) {
      console.log(`Translation worker finished. Total records processed/synced: ${totalProcessed}`);
    }
  } catch (err) {
    console.error("Translation worker background error:", err);
  } finally {
    isTranslationWorkerRunning = false;
  }
}

module.exports = {
  translateRecord,
  runTranslationWorker
};
