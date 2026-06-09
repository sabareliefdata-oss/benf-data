require('dotenv').config();
const { google } = require('googleapis');

console.log("=== DIAGNOSTIC REPORT ===");
console.log("Client Email:", process.env.GOOGLE_CLIENT_EMAIL);
console.log("Private Key Length:", process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.length : 0);
if (process.env.GOOGLE_PRIVATE_KEY) {
  console.log("Private Key Starts With:", process.env.GOOGLE_PRIVATE_KEY.substring(0, 40));
  console.log("Private Key Ends With:", process.env.GOOGLE_PRIVATE_KEY.substring(process.env.GOOGLE_PRIVATE_KEY.length - 40));
  console.log("Has literal \\n:", process.env.GOOGLE_PRIVATE_KEY.includes('\\n'));
  console.log("Has actual newlines:", process.env.GOOGLE_PRIVATE_KEY.includes('\n'));
} else {
  console.log("Private Key is completely missing!");
}
console.log("Folder ID:", process.env.GOOGLE_DRIVE_FOLDER_ID);

async function testAuth() {
  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY 
      ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') 
      : null;

    if (!clientEmail || !privateKey) {
      console.log("❌ Credentials missing!");
      return;
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive']
    });

    console.log("Attempting to get access token...");
    const token = await auth.getAccessToken();
    console.log("✅ Success! Access Token obtained:", token.token ? "Token exists (secret)" : "No token returned");
    
    // Test listing files
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.list({ pageSize: 1 });
    console.log("✅ Success! Able to list files from Drive.");
  } catch (error) {
    console.log("❌ Authentication failed!");
    console.error("Error details:", error.message);
    if (error.response && error.response.data) {
      console.error("Response data:", JSON.stringify(error.response.data));
    }
  }
}

testAuth();
