const mongoose = require('mongoose');

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://username:password@cluster.mongodb.net/whatsapp';

let cachedConnection = null;

async function connectToDatabase() {
  if (cachedConnection) {
    return cachedConnection;
  }

  const connection = await mongoose.connect(MONGODB_URI);
  cachedConnection = connection;
  return connection;
}

// Message Schema
const messageSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  meta_msg_id: String,
  wa_id: { type: String, required: true },
  profile_name: String,
  body: String,
  timestamp: { type: Date, default: Date.now },
  type: { type: String, enum: ['text', 'image', 'document', 'audio', 'video'], default: 'text' },
  status: { type: String, enum: ['sent', 'delivered', 'read', 'failed'], default: 'sent' },
  direction: { type: String, enum: ['incoming', 'outgoing'], default: 'incoming' },
  media_url: String,
  media_mime_type: String,
  media_sha256: String,
  caption: String
}, { timestamps: true });

// Check if model already exists to avoid re-compilation error
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema, 'processed_messages');

// User Schema for contact information
const userSchema = new mongoose.Schema({
  wa_id: { type: String, unique: true, required: true },
  profile_name: String,
  last_seen: { type: Date, default: Date.now },
  profile_picture: String
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await connectToDatabase();

    if (req.method === 'POST') {
      // Send a new message
      const { wa_id, body, profile_name, type = 'text' } = req.body;
      
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newMessage = new Message({
        id: messageId,
        meta_msg_id: messageId,
        wa_id,
        profile_name: profile_name || 'You',
        body,
        type,
        direction: 'outgoing',
        status: 'sent'
      });

      await newMessage.save();

      // Update or create user
      await User.findOneAndUpdate(
        { wa_id },
        { 
          wa_id, 
          profile_name: profile_name || 'Unknown User',
          last_seen: new Date()
        },
        { upsert: true }
      );

      res.status(201).json(newMessage);
    } else {
      res.status(405).json({ error: 'Method not allowed. Use POST to send messages.' });
    }
  } catch (error) {
    console.error('Messages API error:', error);
    res.status(500).json({ error: error.message });
  }
};
