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

const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? '' // Same domain for production (Vercel will handle routing)
    : 'http://localhost:5000');

console.log('API_BASE_URL:', API_BASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Initialize socket connection (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
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
    }
  }, [selectedChat]);

  // Polling for updates in production
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && selectedChat) {
      const interval = setInterval(() => {
        fetchMessages(selectedChat);
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(interval);
    }
  }, [selectedChat]);

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      console.log('Fetching conversations from:', `${API_BASE_URL}/api/conversations`);
      const response = await axios.get(`${API_BASE_URL}/api/conversations`);
      console.log('Conversations response:', response.data);
      
      // The backend already returns processed conversations in the correct format
      const processedConversations = response.data.map((conv: any) => ({
        _id: conv._id,
        lastMessage: conv.lastMessage || 'No messages',
        lastMessageTime: conv.lastMessageTime || new Date().toISOString(),
        profile_name: conv.profile_name || 'Unknown',
        unreadCount: conv.unreadCount || 0
      }));
      
      console.log('Processed conversations:', processedConversations);
      setConversations(processedConversations);
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
      
      // Backend already returns processed messages in the correct format
      const transformedMessages = response.data.map((msg: any) => ({
        _id: msg._id || msg.id,
        id: msg.id,
        wa_id: msg.wa_id,
        profile_name: msg.profile_name,
        body: msg.body,
        timestamp: msg.timestamp,
        type: msg.type,
        status: msg.status,
        direction: msg.direction,
        media_url: msg.media_url,
        caption: msg.caption
      }));
      
      setMessages(transformedMessages);
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const loadSampleData = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/load-sample-data`);
      fetchConversations();
    } catch (error) {
      console.error('Error loading sample data:', error);
    }
  };

  useEffect(() => {
    // Load sample data first, then fetch conversations
    const initializeApp = async () => {
      try {
        await loadSampleData();
        await fetchConversations();
      } catch (error) {
        // If sample data loading fails, still try to fetch conversations
        await fetchConversations();
      }
    };
    
    initializeApp();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
            <Box className="messages-container" sx={{ 
              flex: 1, 
              overflowY: 'auto',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              backgroundColor: '#e5ddd5',
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29-22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%239C92AC\' fill-opacity=\'0.05\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")'
            }}>
              {messages.map((message) => (
                <Box
                  key={message._id}
                  sx={{
                    display: 'flex',
                    justifyContent: message.direction === 'outgoing' ? 'flex-end' : 'flex-start',
                    width: '100%',
                    px: 1,
                    py: 0.5,
                    position: 'relative'
                  }}
                >
                  <Box
                    sx={{
                      maxWidth: '65%',
                      p: '6px 7px 8px 9px',
                      borderRadius: '7.5px',
                      position: 'relative',
                      backgroundColor: message.direction === 'outgoing' ? '#d9fdd3' : '#ffffff',
                      boxShadow: '0 1px 0.5px rgba(0, 0, 0, 0.13)',
                      ...(message.direction === 'incoming' && {
                        borderTopLeftRadius: '0',
                        marginRight: 'auto',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: '-8px',
                          top: 0,
                          width: 0,
                          height: 0,
                          border: '8px solid transparent',
                          borderRightColor: '#ffffff',
                          borderLeft: 0,
                        },
                      }),
                      ...(message.direction === 'outgoing' && {
                        borderTopRightRadius: '0',
                        marginLeft: 'auto',
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          right: '-8px',
                          top: 0,
                          width: 0,
                          height: 0,
                          border: '8px solid transparent',
                          borderLeftColor: '#d9fdd3',
                          borderRight: 0,
                        },
                      }),
                    }}
                  >
                    <Box sx={{ 
                      fontSize: '14.2px', 
                      lineHeight: '19px', 
                      color: '#111b21',
                      wordWrap: 'break-word',
                      whiteSpace: 'pre-wrap',
                      mb: 0.5,
                      pr: '40px'
                    }}>
                      {message.body}
                    </Box>
                    <Box sx={{ 
                      position: 'absolute',
                      bottom: '4px',
                      right: '7px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      height: '15px',
                      ml: '8px' // Add left margin for better spacing
                    }}>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: message.direction === 'outgoing' ? '#1f7a7a' : '#667781',
                          fontSize: '11px',
                          lineHeight: '15px',
                          whiteSpace: 'nowrap',
                          pt: '3px'
                        }}
                      >
                        {formatTime(message.timestamp)}
                      </Typography>
                      {message.direction === 'outgoing' && (
                        <Box sx={{ 
                          display: 'flex',
                          alignItems: 'center',
                          ml: '2px',
                          '& svg': {
                            width: '16px',
                            height: '16px',
                            color: message.status === 'read' ? '#53bdeb' : '#8696a0'
                          }
                        }}>
                          {getStatusIcon(message.status)}
                        </Box>
                      )}
                    </Box>
                  </Box>
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