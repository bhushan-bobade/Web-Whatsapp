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
    
    const conversations = await Message.aggregate([
      {
        $group: {
          _id: '$wa_id',
          lastMessage: { $last: '$body' },
          lastMessageTime: { $last: '$timestamp' },
          profile_name: { $last: '$profile_name' },
          unreadCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { lastMessageTime: -1 } }
    ]);

    res.json(conversations);
  } catch (error) {
    console.error('Conversations API error:', error);
    res.status(500).json({ error: error.message });
  }
};
