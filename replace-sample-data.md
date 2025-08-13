# Replace Sample Data with Your Assignment JSON Files

## Step-by-Step Instructions

### 1. Prepare Your Assignment Files
- Ensure you have all 8 JSON files from the assignment
- They should be WhatsApp Business API webhook payloads
- Each file should contain either messages or status updates

### 2. Replace the Sample Files

#### Option A: Replace Existing Files
1. Navigate to the `sample-data` folder
2. Delete the existing `payload1.json` through `payload8.json` files
3. Copy your 8 assignment JSON files into this folder
4. Rename them to `payload1.json`, `payload2.json`, ..., `payload8.json`

#### Option B: Keep Original Names (Recommended)
1. Navigate to the `sample-data` folder
2. Delete all existing `.json` files
3. Copy your 8 assignment JSON files directly into this folder
4. Keep their original names - the application will automatically detect all `.json` files

### 3. Verify JSON Format
Each file should follow this structure:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "your_business_account_id",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "your_phone_number",
              "phone_number_id": "your_phone_number_id"
            },
            "contacts": [
              {
                "profile": {
                  "name": "Contact Name"
                },
                "wa_id": "contact_wa_id"
              }
            ],
            "messages": [
              {
                "from": "sender_wa_id",
                "id": "message_id",
                "timestamp": "unix_timestamp",
                "text": {
                  "body": "Message content"
                },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

### 4. Test Your Data
1. Start the application locally: `npm run dev`
2. Click "Load Sample Data" button
3. Verify conversations appear with your actual data
4. Test sending messages and status updates

### 5. Deploy to Vercel
Once you've verified your data works locally:
1. Commit your changes to Git
2. Push to your GitHub repository
3. Deploy to Vercel following the DEPLOYMENT.md guide

## Expected File Structure
```
sample-data/
├── your-file-1.json     # Your actual assignment files
├── your-file-2.json     # Keep original names or rename
├── your-file-3.json     # as payload1.json, payload2.json, etc.
├── your-file-4.json
├── your-file-5.json
├── your-file-6.json
├── your-file-7.json
└── your-file-8.json
```

## Important Notes

1. **File Format**: Ensure all files are valid JSON
2. **Character Encoding**: Use UTF-8 encoding for proper emoji support
3. **File Size**: Keep files under 1MB for optimal loading
4. **Backup**: Keep a backup of your original assignment files

## Troubleshooting

### If messages don't appear:
- Check browser console for errors
- Verify JSON format using an online JSON validator
- Ensure MongoDB connection is working

### If status updates don't work:
- Verify your JSON files contain `statuses` array
- Check that message IDs match between message and status files

### If real-time updates fail:
- Check browser console for Socket.IO connection errors
- Verify server is running and accessible

---

Once you've replaced the sample data with your assignment files, your WhatsApp Web Clone will display the actual conversation data from your assignment! 🎉
