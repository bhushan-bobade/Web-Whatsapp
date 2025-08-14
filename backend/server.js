const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? true  // Allow all origins in production (same domain)
    : ['http://localhost:3000', 'http://localhost:3002'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://username:password@cluster.mongodb.net/whatsapp';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

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

// User Schema for contact information
const userSchema = new mongoose.Schema({
  wa_id: { type: String, unique: true, required: true },
  profile_name: String,
  last_seen: { type: Date, default: Date.now },
  profile_picture: String
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('join_chat', (wa_id) => {
    socket.join(wa_id);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Routes

// Get all conversations
app.get('/api/conversations', async (req, res) => {
  try {
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
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a specific conversation
app.get('/api/messages/:wa_id', async (req, res) => {
  try {
    const { wa_id } = req.params;
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
        // Return empty array but with success status
        return res.json([]);
      }
    }

    res.json(messages.reverse());
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send a new message
app.post('/api/messages', async (req, res) => {
  try {
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

    // Emit to socket
    io.to(wa_id).emit('new_message', newMessage);
    io.emit('conversation_updated', wa_id);

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update message status
app.put('/api/messages/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const message = await Message.findOneAndUpdate(
      { $or: [{ id }, { meta_msg_id: id }] },
      { status },
      { new: true }
    );

    if (message) {
      io.to(message.wa_id).emit('message_status_update', { id, status });
    }

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process webhook payload
app.post('/api/webhook/process-payload', async (req, res) => {
  try {
    const payload = req.body;
    
    if (payload.entry && payload.entry[0] && payload.entry[0].changes) {
      const change = payload.entry[0].changes[0];
      
      if (change.value.messages) {
        // Process incoming messages
        for (const msg of change.value.messages) {
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

            // Emit to socket
            io.to(msg.from).emit('new_message', newMessage);
            io.emit('conversation_updated', msg.from);
          }
        }
      }

      if (change.value.statuses) {
        // Process status updates
        for (const status of change.value.statuses) {
          const message = await Message.findOneAndUpdate(
            { $or: [{ id: status.id }, { meta_msg_id: status.id }] },
            { status: status.status },
            { new: true }
          );

          if (message) {
            io.to(message.wa_id).emit('message_status_update', { id: status.id, status: status.status });
          }
        }
      }
    }

    res.json({ success: true, message: 'Payload processed successfully' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Load sample data from JSON files
app.post('/api/load-sample-data', async (req, res) => {
  try {
    const sampleDataPath = path.join(__dirname, '../sample-data');
    
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
});

// Debug endpoint to check messages in database
app.get('/api/debug/messages', async (req, res) => {
  try {
    const allMessages = await Message.find({}).limit(10).sort({ timestamp: -1 });
    const messagesByWaId = await Message.aggregate([
      {
        $group: {
          _id: '$wa_id',
          count: { $sum: 1 },
          lastMessage: { $last: '$body' },
          profile_name: { $last: '$profile_name' }
        }
      }
    ]);
    
    res.json({
      totalMessages: await Message.countDocuments({}),
      recentMessages: allMessages,
      messagesByWaId: messagesByWaId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
