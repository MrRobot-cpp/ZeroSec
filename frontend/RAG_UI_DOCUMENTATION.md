# RAG UI Documentation

## Overview
The RAG (Retrieval-Augmented Generation) UI provides a ChatGPT-like interface for users to interact with your security data through natural language queries.

## Features
- Clean, professional chat interface
- Real-time message streaming
- Auto-scrolling to latest messages
- Loading indicators
- Error handling with user feedback
- Clear chat functionality
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- Message metadata display (sources, timestamps)

## File Structure

```
frontend/src/
├── components/
│   └── RagChat.jsx                 # Main chat UI component
├── hooks/
│   └── useRagChat.js               # Custom hook for chat logic
├── services/
│   └── ragService.js               # API service layer
└── app/
    └── rag/
        └── page.js                 # RAG page route
```

## Backend Integration

### Environment Setup

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Update the backend API URL:
   ```env
   NEXT_PUBLIC_API_URL=http://your-backend-url:port/api
   ```

### Required Backend Endpoint

The frontend expects the following endpoint structure:

#### POST `/api/query`

**Request:**
```json
{
  "question": "What are the recent security threats?"
}
```

**Response:**
```json
{
  "answer": "Based on the logs, there have been 3 security threats...",
  "sources": ["log_id_1", "log_id_2"],
  "metadata": {
    "confidence": 0.95,
    "processing_time": 1.2
  }
}
```

### Current Backend Endpoint
Your existing backend endpoint is at: `Backend/api/query.py`

The endpoint path is: `/query`

**Mapping:**
- Frontend calls: `${API_BASE_URL}/query`
- Backend expects: POST request with `{ "question": "..." }`
- Backend returns: `{ "answer": "...", ... }`

### Connection Steps

1. **Update API Base URL** (if needed)

   In `frontend/src/services/ragService.js`, verify the API_BASE_URL matches your backend:
   ```javascript
   const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
   ```

2. **Add Authentication** (if required)

   In `frontend/src/services/ragService.js`, uncomment and update the authorization header:
   ```javascript
   headers: {
     "Content-Type": "application/json",
     "Authorization": `Bearer ${token}`,
   },
   ```

3. **Adjust Response Mapping** (if needed)

   If your backend returns different field names, update the mapping in `ragService.js`:
   ```javascript
   return {
     answer: data.answer || data.response || "No answer provided",
     sources: data.sources || [],
     metadata: data.metadata || {},
   };
   ```

### Testing the Connection

1. Start your backend server
2. Start the frontend: `npm run dev`
3. Navigate to: `http://localhost:3000/rag`
4. Ask a test question
5. Check browser console for any errors

## Component Usage

### Using RagChat Component

```jsx
import RagChat from "@/components/RagChat";

export default function MyPage() {
  return (
    <div className="h-screen">
      <RagChat />
    </div>
  );
}
```

### Using the Custom Hook

```javascript
import { useRagChat } from "@/hooks/useRagChat";

function MyCustomChat() {
  const { messages, isLoading, error, sendQuery, clearMessages } = useRagChat();

  // Your custom implementation
}
```

## Customization

### Styling
The UI uses Tailwind CSS. Update classes in `RagChat.jsx` to match your design system.

### Message Format
Modify message rendering in the `RagChat.jsx` component around line 71-97.

### API Error Handling
Customize error messages in `useRagChat.js` around line 44-50.

## Navigation

The RAG Assistant is accessible via:
- **Sidebar**: Click "RAG Assistant" in the sidebar
- **Direct URL**: Navigate to `/rag`
- **Programmatic**: Use Next.js router: `router.push('/rag')`

## Troubleshooting

### Common Issues

1. **"Failed to get response" error**
   - Check if backend is running
   - Verify API_BASE_URL in `.env.local`
   - Check browser console for CORS errors

2. **CORS errors**
   - Add CORS headers to your Flask backend:
     ```python
     from flask_cors import CORS
     CORS(app)
     ```

3. **No response showing**
   - Check backend response format matches expected structure
   - Verify the response mapping in `ragService.js`

4. **Authentication errors**
   - Ensure auth tokens are properly included in headers
   - Check token expiration

## Future Enhancements

Optional features you can add:

- [ ] Conversation history persistence
- [ ] Message editing/deletion
- [ ] File upload for context
- [ ] Voice input/output
- [ ] Markdown rendering in responses
- [ ] Code syntax highlighting
- [ ] Export chat history
- [ ] Multi-language support
- [ ] Streaming responses (SSE)
- [ ] Message reactions/feedback

## Support

For issues or questions:
1. Check backend logs for errors
2. Review browser console for client-side errors
3. Verify API endpoints are accessible
4. Test backend endpoint independently (e.g., with Postman)
