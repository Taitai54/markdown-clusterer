const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

async function verifyApiKey() {
    console.log('Verifying API Key...');

    // 1. Read .env manualy (matching main.js logic)
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
        console.error('❌ .env file not found at:', envPath);
        process.exit(1);
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/OPENAI_API_KEY=(.+)/);

    if (!match || !match[1]) {
        console.error('❌ Could not find OPENAI_API_KEY in .env');
        process.exit(1);
    }

    const apiKey = match[1].trim();
    console.log('✅ Found API Key in .env (length:', apiKey.length, ')');
    // console.log('Key preview:', apiKey.substring(0, 10) + '...');

    // 2. Initialize OpenAI
    const openai = new OpenAI({ apiKey });

    // 3. Test connection (List Models)
    try {
        console.log('Attempting to list models...');
        const list = await openai.models.list();
        console.log('✅ Connection successful!');
        console.log('Available models:', list.data.length);

        // Check for gpt-4o specifically as we use it
        const hasGpt4o = list.data.some(m => m.id === 'gpt-4o');
        if (hasGpt4o) {
            console.log('✅ Model "gpt-4o" is available.');
        } else {
            console.log('⚠️ Model "gpt-4o" not found in user access list (might be restricted).');
        }

    } catch (error) {
        console.error('❌ API Verification Failed:', error.message);
        if (error.status === 401) {
            console.log('-> This indicates the API Key is invalid or expired.');
        }
        process.exit(1);
    }
}

verifyApiKey();
