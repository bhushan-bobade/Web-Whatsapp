const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

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

// User Schema
const userSchema = new mongoose.Schema({
  wa_id: { type: String, unique: true, required: true },
  profile_name: String,
  last_seen: { type: Date, default: Date.now },
  profile_picture: String
}, { timestamps: true });

// Check if models already exist to avoid re-compilation error
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema, 'processed_messages');
const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = async (req, res) => {
  try {
    await connectToDatabase();
    
    const sampleDataPath = path.join(__dirname, 'sample-data');
    
    if (!fs.existsSync(sampleDataPath)) {
      return res.status(400).json({ error: 'Sample data directory not found' });
    }

    const files = fs.readdirSync(sampleDataPath).filter(file => file.endsWith('.json'));
    
    let processedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(sampleDataPath, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const payload = JSON.parse(fileContent);
      
      // Process the payload using the same logic as webhook
      // Handle your specific JSON format with metaData wrapper
      let webhookData = payload;
      if (payload.metaData) {
        webhookData = payload.metaData;
      }
      
      if (webhookData.entry && webhookData.entry[0] && webhookData.entry[0].changes) {
        const change = webhookData.entry[0].changes[0];
        
        if (change.value.messages) {
          for (const msg of change.value.messages) {
            const existingMessage = await Message.findOne({ id: msg.id });
            
            if (!existingMessage) {
              const contact = change.value.contacts?.find(c => c.wa_id === msg.from);
              
              // Determine direction and conversation wa_id
              const businessPhone = change.value.metadata?.display_phone_number;
              const isOutgoing = msg.from === businessPhone;
              
              // For conversation grouping, always use the customer's wa_id
              const customerWaId = isOutgoing ? 
                (change.value.contacts?.[0]?.wa_id || 'unknown') : 
                msg.from;
              
              const newMessage = new Message({
                id: msg.id,
                meta_msg_id: msg.id,
                wa_id: customerWaId, // Always use customer's wa_id for grouping
                profile_name: contact?.profile?.name || 'Unknown User',
                body: msg.text?.body || msg.image?.caption || msg.document?.filename || 'Media message',
                type: msg.type,
                direction: isOutgoing ? 'outgoing' : 'incoming',
                timestamp: new Date(parseInt(msg.timestamp) * 1000),
                media_url: msg.image?.link || msg.document?.link || msg.audio?.link || msg.video?.link,
                media_mime_type: msg.image?.mime_type || msg.document?.mime_type || msg.audio?.mime_type || msg.video?.mime_type,
                media_sha256: msg.image?.sha256 || msg.document?.sha256 || msg.audio?.sha256 || msg.video?.sha256,
                caption: msg.image?.caption || msg.video?.caption
              });

              await newMessage.save();
              processedCount++;

              // Update or create user
              if (contact) {
                await User.findOneAndUpdate(
                  { wa_id: msg.from },
                  { 
                    wa_id: msg.from,
                    profile_name: contact.profile.name,
                    last_seen: new Date()
                  },
                  { upsert: true }
                );
              }
            }
          }
        }

        if (change.value.statuses) {
          for (const status of change.value.statuses) {
            await Message.findOneAndUpdate(
              { $or: [{ id: status.id }, { meta_msg_id: status.id }] },
              { status: status.status },
              { new: true }
            );
          }
        }
      }
    }

    res.json({ 
      success: true, 
      message: `Sample data loaded successfully. Processed ${processedCount} messages from ${files.length} files.` 
    });
  } catch (error) {
    console.error('Sample data loading error:', error);
    res.status(500).json({ error: error.message });
  }
};
