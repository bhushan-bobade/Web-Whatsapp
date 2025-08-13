const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://username:password@cluster.mongodb.net/whatsapp';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

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

const Message = mongoose.model('Message', messageSchema, 'processed_messages');

// User Schema
const userSchema = new mongoose.Schema({
  wa_id: { type: String, unique: true, required: true },
  profile_name: String,
  last_seen: { type: Date, default: Date.now },
  profile_picture: String
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function processPayloads() {
  try {
    const sampleDataPath = path.join(__dirname, '../sample-data');
    
    if (!fs.existsSync(sampleDataPath)) {
      console.error('Sample data directory not found. Please create the sample-data directory and add your JSON files.');
      process.exit(1);
    }

    const files = fs.readdirSync(sampleDataPath).filter(file => file.endsWith('.json'));
    
    if (files.length === 0) {
      console.error('No JSON files found in sample-data directory.');
      process.exit(1);
    }

    console.log(`Found ${files.length} JSON files to process...`);
    
    let totalProcessed = 0;
    let totalStatusUpdates = 0;
    
    for (const file of files) {
      console.log(`Processing ${file}...`);
      
      const filePath = path.join(sampleDataPath, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const payload = JSON.parse(fileContent);
      
      // Handle your specific JSON format with metaData wrapper
      let webhookData = payload;
      if (payload.metaData) {
        webhookData = payload.metaData;
      }
      
      if (webhookData.entry && webhookData.entry[0] && webhookData.entry[0].changes) {
        const change = webhookData.entry[0].changes[0];
        
        // Process messages
        if (change.value.messages) {
          for (const msg of change.value.messages) {
            try {
              const existingMessage = await Message.findOne({ id: msg.id });
              
              if (!existingMessage) {
                const contact = change.value.contacts?.find(c => c.wa_id === msg.from);
                
                const newMessage = new Message({
                  id: msg.id,
                  meta_msg_id: msg.id,
                  wa_id: msg.from,
                  profile_name: contact?.profile?.name || 'Unknown User',
                  body: msg.text?.body || msg.image?.caption || msg.document?.filename || 'Media message',
                  type: msg.type,
                  direction: 'incoming',
                  timestamp: new Date(parseInt(msg.timestamp) * 1000),
                  media_url: msg.image?.link || msg.document?.link || msg.audio?.link || msg.video?.link,
                  media_mime_type: msg.image?.mime_type || msg.document?.mime_type || msg.audio?.mime_type || msg.video?.mime_type,
                  media_sha256: msg.image?.sha256 || msg.document?.sha256 || msg.audio?.sha256 || msg.video?.sha256,
                  caption: msg.image?.caption || msg.video?.caption
                });

                await newMessage.save();
                totalProcessed++;
                console.log(`  ✓ Saved message from ${contact?.profile?.name || msg.from}: ${msg.text?.body?.substring(0, 50) || 'Media message'}...`);

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
              } else {
                console.log(`  - Message ${msg.id} already exists, skipping...`);
              }
            } catch (error) {
              console.error(`  ✗ Error processing message ${msg.id}:`, error.message);
            }
          }
        }

        // Process status updates
        if (change.value.statuses) {
          for (const status of change.value.statuses) {
            try {
              const message = await Message.findOneAndUpdate(
                { $or: [{ id: status.id }, { meta_msg_id: status.id }] },
                { status: status.status },
                { new: true }
              );

              if (message) {
                totalStatusUpdates++;
                console.log(`  ✓ Updated message ${status.id} status to ${status.status}`);
              } else {
                console.log(`  - Message ${status.id} not found for status update`);
              }
            } catch (error) {
              console.error(`  ✗ Error updating status for message ${status.id}:`, error.message);
            }
          }
        }
      } else {
        console.log(`  - Invalid payload structure in ${file}`);
      }
    }
    
    console.log('\n=== Processing Complete ===');
    console.log(`Total messages processed: ${totalProcessed}`);
    console.log(`Total status updates: ${totalStatusUpdates}`);
    console.log(`Total files processed: ${files.length}`);
    
    // Display conversation summary
    const conversations = await Message.aggregate([
      {
        $group: {
          _id: '$wa_id',
          profile_name: { $last: '$profile_name' },
          messageCount: { $sum: 1 },
          lastMessage: { $last: '$body' },
          lastMessageTime: { $last: '$timestamp' }
        }
      },
      { $sort: { lastMessageTime: -1 } }
    ]);

    console.log('\n=== Conversation Summary ===');
    conversations.forEach(conv => {
      console.log(`${conv.profile_name} (${conv._id}): ${conv.messageCount} messages`);
      console.log(`  Last: ${conv.lastMessage?.substring(0, 100)}...`);
    });
    
  } catch (error) {
    console.error('Error processing payloads:', error);
  } finally {
    mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

// Run the script
processPayloads();
