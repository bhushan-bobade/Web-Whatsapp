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

module.exports = async (req, res) => {
  try {
    await connectToDatabase();

    const { wa_id } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    console.log(`Fetching messages for wa_id: ${wa_id}`);
    
    const messages = await Message.find({ wa_id })
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip);

    console.log(`Found ${messages.length} messages for ${wa_id}`);
    
    // If no messages found, check if wa_id exists at all
    if (messages.length === 0) {
      const totalMessages = await Message.countDocuments({ wa_id });
      console.log(`Total messages in DB for ${wa_id}: ${totalMessages}`);
      
      if (totalMessages === 0) {
        return res.json([]);
      }
    }

    res.json(messages.reverse());
  } catch (error) {
    console.error('Messages API error:', error);
    res.status(500).json({ error: error.message });
  }
};
