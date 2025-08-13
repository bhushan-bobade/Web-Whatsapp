# WhatsApp Web Clone

A full-stack WhatsApp Web clone built with React, Node.js, Express, MongoDB, and Socket.IO. This application simulates real-time WhatsApp conversations using webhook data and provides a responsive, mobile-friendly interface that closely mimics WhatsApp Web.

## 🌟 Features

- **WhatsApp-like UI**: Clean, responsive interface that looks and behaves like WhatsApp Web
- **Real-time messaging**: Socket.IO integration for instant message updates
- **Webhook processing**: Processes WhatsApp Business API webhook payloads
- **Message status tracking**: Shows sent, delivered, and read status indicators
- **Responsive design**: Works seamlessly on desktop and mobile devices
- **Sample data loader**: Easy loading of sample conversations from JSON files
- **MongoDB integration**: Persistent message storage with MongoDB Atlas

## 🚀 Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **Socket.IO** for real-time communication
- **CORS** for cross-origin requests
- **dotenv** for environment configuration

### Frontend
- **React 18** with TypeScript
- **Material-UI (MUI)** for UI components
- **Socket.IO Client** for real-time updates
- **Axios** for HTTP requests
- **date-fns** for date formatting

## 📋 Prerequisites

Before running this application, make sure you have:

- **Node.js** (version 16 or higher)
- **npm** or **yarn**
- **MongoDB Atlas** account and cluster
- **Git** (for deployment)

## 🛠️ Installation & Setup

### 1. Clone the repository
```bash
git clone <repository-url>
cd whatsapp-web-clone
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory:
```env
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/whatsapp
PORT=5000
NODE_ENV=development
JWT_SECRET=your-jwt-secret-key-here
CORS_ORIGIN=http://localhost:3000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file in the frontend directory:
```env
REACT_APP_API_URL=http://localhost:5000
```

## 🚀 Running the Application

### Development Mode

1. **Start the backend server:**
```bash
cd backend
npm run dev
```
The server will run on http://localhost:5000

2. **Start the frontend development server:**
```bash
cd frontend
npm start
```
The React app will run on http://localhost:3000

### Production Mode

1. **Build the frontend:**
```bash
cd frontend
npm run build
```

2. **Start the production server:**
```bash
cd backend
npm start
```

## 📊 Loading Sample Data

The application comes with 8 sample JSON payload files that simulate WhatsApp Business API webhooks:

1. **Via Frontend**: Click the "Load Sample Data" button in the sidebar
2. **Via Backend Script**: 
```bash
cd backend
npm run process-payloads
```

### Sample Data Structure
- **payload1.json**: Message from John Doe
- **payload2.json**: Message from Alice Smith  
- **payload3.json**: Message from Bob Johnson
- **payload4.json**: Follow-up message from John Doe
- **payload5.json**: Message from Maria Garcia
- **payload6.json**: Follow-up message from Alice Smith
- **payload7.json**: Status updates (delivered/read)
- **payload8.json**: Message from David Wilson

## 🗄️ Database Schema

### Messages Collection (`processed_messages`)
```javascript
{
  id: String (unique),
  meta_msg_id: String,
  wa_id: String (required),
  profile_name: String,
  body: String,
  timestamp: Date,
  type: String (text, image, document, audio, video),
  status: String (sent, delivered, read, failed),
  direction: String (incoming, outgoing),
  media_url: String,
  media_mime_type: String,
  media_sha256: String,
  caption: String
}
```

### Users Collection
```javascript
{
  wa_id: String (unique, required),
  profile_name: String,
  last_seen: Date,
  profile_picture: String
}
```

## 🔌 API Endpoints

### Conversations
- `GET /api/conversations` - Get all conversations
- `GET /api/messages/:wa_id` - Get messages for a specific user

### Messages
- `POST /api/messages` - Send a new message
- `PUT /api/messages/:id/status` - Update message status

### Webhooks
- `POST /api/webhook/process-payload` - Process WhatsApp webhook payload
- `POST /api/load-sample-data` - Load sample data from JSON files

### Health Check
- `GET /api/health` - Server health check

## 🎨 UI Components

The application replicates WhatsApp Web's interface with:

- **Sidebar**: Contact list with search functionality
- **Chat Header**: Contact info and action buttons
- **Message Area**: Scrollable message history with proper alignment
- **Message Input**: Text input with emoji and attachment icons
- **Status Indicators**: Single/double check marks with color coding
- **Responsive Design**: Mobile-first responsive layout

## 🔄 Real-time Features

Using Socket.IO for:
- **New message notifications**
- **Message status updates** 
- **Conversation list updates**
- **Online/offline status** (future enhancement)

## 🌐 Deployment Options

### Render.com (Recommended)
1. Connect your GitHub repository
2. Set environment variables
3. Deploy both frontend and backend

### Vercel (Frontend) + Render (Backend)
1. Deploy frontend to Vercel
2. Deploy backend to Render
3. Update CORS and API URLs

### Heroku
1. Create Heroku apps for frontend and backend
2. Set up MongoDB Atlas connection
3. Configure environment variables

## 📱 Mobile Responsiveness

The application is fully responsive with:
- **Breakpoint at 768px**: Stacked layout for tablets
- **Breakpoint at 480px**: Optimized for mobile phones
- **Touch-friendly**: Proper button sizes and spacing
- **Viewport optimized**: Correct meta tags and CSS

## 🔧 Environment Variables

### Backend (.env)
```env
MONGODB_URI=your-mongodb-connection-string
PORT=5000
NODE_ENV=production
JWT_SECRET=your-secret-key
CORS_ORIGIN=https://your-frontend-url.com
```

### Frontend (.env)
```env
REACT_APP_API_URL=https://your-backend-url.com
```

## 📚 Usage Examples

### Sending a Message via API
```javascript
const response = await axios.post('/api/messages', {
  wa_id: '16505551234',
  body: 'Hello, this is a test message!',
  profile_name: 'John Doe'
});
```

### Processing a Webhook Payload
```javascript
const response = await axios.post('/api/webhook/process-payload', webhookPayload);
```

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Check your connection string
   - Ensure IP is whitelisted in MongoDB Atlas
   - Verify username/password

2. **CORS Issues**
   - Update CORS_ORIGIN in backend .env
   - Check frontend API URL configuration

3. **Socket.IO Connection Failed**
   - Verify backend server is running
   - Check firewall settings
   - Ensure Socket.IO port is accessible

### Debug Mode
Set `NODE_ENV=development` to enable detailed error logging.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- WhatsApp Web for design inspiration
- Material-UI for React components
- Socket.IO for real-time functionality
- MongoDB for data persistence

## 🔮 Future Enhancements

- [ ] File upload and media messages
- [ ] Voice message support
- [ ] Group chat functionality
- [ ] User authentication
- [ ] Push notifications
- [ ] Message encryption
- [ ] Dark mode theme
- [ ] Message search functionality

## 📞 Support

For support, please open an issue in the GitHub repository or contact the development team.

---

Built with ❤️ for the WhatsApp Web Clone evaluation task.
