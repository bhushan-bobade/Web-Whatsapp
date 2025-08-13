import React, { useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Badge,
  InputAdornment,
} from '@mui/material';
import {
  Send as SendIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  AttachFile as AttachFileIcon,
  EmojiEmotions as EmojiEmotionsIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import './App.css';

interface Message {
  _id: string;
  id: string;
  wa_id: string;
  profile_name: string;
  body: string;
  timestamp: string;
  type: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  direction: 'incoming' | 'outgoing';
  media_url?: string;
  caption?: string;
}

interface Conversation {
  _id: string;
  lastMessage: string;
  lastMessageTime: string;
  profile_name: string;
  unreadCount: number;
}

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '' // Use relative URLs in production (same domain)
  : 'http://localhost:5000';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(API_BASE_URL);
    setSocket(newSocket);

    newSocket.on('new_message', (message: Message) => {
      if (selectedChat === message.wa_id) {
        setMessages(prev => [...prev, message]);
      }
      fetchConversations();
    });

    newSocket.on('conversation_updated', () => {
      fetchConversations();
    });

    newSocket.on('message_status_update', ({ id, status }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === id ? { ...msg, status } : msg
      ));
    });

    return () => {
      newSocket.close();
    };
  }, [selectedChat]);

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/conversations`);
      setConversations(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setLoading(false);
    }
  };

  // Fetch messages for selected chat
  const fetchMessages = async (wa_id: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/messages/${wa_id}`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    try {
      const selectedConversation = conversations.find(c => c._id === selectedChat);
      await axios.post(`${API_BASE_URL}/api/messages`, {
        wa_id: selectedChat,
        body: newMessage,
        profile_name: selectedConversation?.profile_name || 'Unknown User'
      });
      setNewMessage('');
      fetchMessages(selectedChat);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Load sample data
  const loadSampleData = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/load-sample-data`);
      fetchConversations();
    } catch (error) {
      console.error('Error loading sample data:', error);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const handleChatSelect = (wa_id: string) => {
    setSelectedChat(wa_id);
    fetchMessages(wa_id);
    if (socket) {
      socket.emit('join_chat', wa_id);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckIcon sx={{ fontSize: 14, color: '#667781' }} />;
      case 'delivered':
        return <DoneAllIcon sx={{ fontSize: 14, color: '#667781' }} />;
      case 'read':
        return <DoneAllIcon sx={{ fontSize: 14, color: '#4fc3f7' }} />;
      default:
        return null;
    }
  };

  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'HH:mm');
  };

  const filteredConversations = conversations.filter(conv =>
    conv.profile_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box className="whatsapp-container">
      {/* Sidebar */}
      <Paper className="sidebar" elevation={1}>
        {/* Header */}
        <Box className="sidebar-header">
          <Avatar sx={{ bgcolor: '#00bcd4' }}>W</Avatar>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton>
            <MoreVertIcon />
          </IconButton>
        </Box>

        {/* Search */}
        <Box className="search-container">
          <TextField
            fullWidth
            placeholder="Search or start new chat"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>


        {/* Conversations List */}
        <List className="conversations-list">
          {loading ? (
            <ListItem>
              <ListItemText primary="Loading conversations..." />
            </ListItem>
          ) : filteredConversations.length === 0 ? (
            <ListItem>
              <ListItemText primary="No conversations found" />
            </ListItem>
          ) : (
            filteredConversations.map((conversation) => (
              <ListItem
                key={conversation._id}
                component="div"
                onClick={() => handleChatSelect(conversation._id)}
                className={selectedChat === conversation._id ? 'selected-chat' : ''}
                sx={{ cursor: 'pointer' }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: '#00bcd4' }}>
                    {conversation.profile_name.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle1" noWrap>
                        {conversation.profile_name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {formatTime(conversation.lastMessageTime)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" noWrap color="textSecondary">
                        {conversation.lastMessage}
                      </Typography>
                      {conversation.unreadCount > 0 && (
                        <Badge badgeContent={conversation.unreadCount} color="primary" />
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))
          )}
        </List>
      </Paper>

      {/* Chat Area */}
      <Box className="chat-area">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <Paper className="chat-header" elevation={1}>
              <Avatar sx={{ bgcolor: '#00bcd4', mr: 2 }}>
                {conversations.find(c => c._id === selectedChat)?.profile_name.charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6">
                  {conversations.find(c => c._id === selectedChat)?.profile_name}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {selectedChat}
                </Typography>
              </Box>
              <IconButton>
                <SearchIcon />
              </IconButton>
              <IconButton>
                <MoreVertIcon />
              </IconButton>
            </Paper>

            {/* Messages */}
            <Box className="messages-container">
              {messages.map((message) => (
                <Box
                  key={message._id}
                  className={`message ${message.direction === 'outgoing' ? 'outgoing' : 'incoming'}`}
                >
                  <Paper
                    className={`message-bubble ${message.direction}`}
                    elevation={1}
                  >
                    <Typography variant="body2">{message.body}</Typography>
                    <Box className="message-info">
                      <Typography variant="caption" color="textSecondary">
                        {formatTime(message.timestamp)}
                      </Typography>
                      {message.direction === 'outgoing' && (
                        <Box className="message-status">
                          {getStatusIcon(message.status)}
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Box>
              ))}
            </Box>

            {/* Message Input */}
            <Paper className="message-input-container" elevation={1}>
              <IconButton>
                <EmojiEmotionsIcon />
              </IconButton>
              <IconButton>
                <AttachFileIcon />
              </IconButton>
              <TextField
                fullWidth
                placeholder="Type a message"
                variant="outlined"
                size="small"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                multiline
                maxRows={4}
              />
              <IconButton onClick={sendMessage} color="primary">
                <SendIcon />
              </IconButton>
            </Paper>
          </>
        ) : (
          <Box className="no-chat-selected">
            <Typography variant="h4" color="textSecondary">
              WhatsApp Web Clone
            </Typography>
            <Typography variant="body1" color="textSecondary" sx={{ mt: 2 }}>
              Select a conversation to start messaging
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Your conversations from JSON files are automatically loaded
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default App;
