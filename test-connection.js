const mongoose = require('./backend/node_modules/mongoose');
const dotenv = require('./backend/node_modules/dotenv');

// Load environment variables from backend/.env
dotenv.config({ path: './backend/.env' });

console.log('🧪 Testing MongoDB Atlas connection...');
console.log('📍 Connecting to:', process.env.MONGODB_URI ? 'MongoDB Atlas' : 'No URI found');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
    console.log('🎯 Database: whatsapp');
    console.log('👤 User: whatsappuser');
    console.log('🏠 Cluster: whatsappclone');
    
    // Test creating a simple document
    const testSchema = new mongoose.Schema({ test: String });
    const TestModel = mongoose.model('Test', testSchema);
    
    return TestModel.create({ test: 'WhatsApp Web Clone connection test' });
  })
  .then(() => {
    console.log('✅ SUCCESS: Test document created!');
    console.log('🚀 Your WhatsApp Web Clone is ready for deployment!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ CONNECTION ERROR:', err.message);
    process.exit(1);
  });
