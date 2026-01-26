# ZeroSec Canary Watermarking - Frontend Requirements

## Package.json Dependencies (Frontend)

### Core Requirements (Already Installed)
```json
{
  "react": "^19.2.0",
  "next": "15.5.6",
  "tailwindcss": "4.1.14"
}
```

These are the only dependencies needed for the canary frontend features.

---

## Frontend Components

### Canary Watermark Component
**Location:** `src/components/CanaryWatermark.jsx`

**Features:**
- File upload for PDF, DOCX, TXT formats
- Progress tracking with XMLHttpRequest
- Watermarked file auto-download
- History table showing generated canaries
- One-click "Upload to RAG" button
- Delete confirmation modal

**Props:**
- `fileInputRef` - Reference to hidden file input
- `setUploading` - Callback to update upload status
- `uploading` - Current upload status

**API Calls:**
- POST `/canary/watermark` - Watermark endpoint
- POST `/documents/upload` - Upload to RAG

---

## Frontend Pages & Routes

### Canary Page
**Route:** `/canary`
**Component:** `src/app/canary/page.js`
**Features:**
- Main canary watermarking interface
- File upload form
- Progress indicator
- History table
- Action buttons (download, upload to RAG, delete)

---

## Frontend Dependencies for Canary Feature

### Required
- **React** 19.2.0+ - Core UI framework
- **Next.js** 15.5.6+ - Page routing and API integration
- **Tailwind CSS** 4.1.14+ - Styling and responsive design

### Browser APIs (No npm needed)
- **XMLHttpRequest** - Progress tracking during upload
- **File API** - File reading and blob handling
- **Fetch API** - HTTP requests to backend
- **localStorage** - Persist canary history

---

## UI/UX Components Used

### Tailwind Classes
```
Colors:
- bg-gray-800, bg-gray-900
- text-gray-300, text-white
- border-gray-700
- bg-green-900/30, text-green-300 (success states)
- bg-red-900/30, text-red-300 (error states)
- bg-blue-600, bg-blue-700 (actions)

Spacing:
- p-3, p-4, p-6 (padding)
- gap-2, gap-3, gap-4 (gaps)
- mb-2, mb-4 (margins)

Layout:
- flex, flex-col (layout)
- justify-between, items-center (alignment)
- overflow-auto (scrolling)
- rounded-lg, rounded-xl (borders)
- shadow (depth)
```

### Icons & Emojis (Will be removed for enterprise version)
Current: 🐤 🔒 📄 ✓ ✕
Planned: Remove and use CSS/SVG for enterprise look

---

## File Upload Specifications

### Supported File Types
- **.pdf** - PDF documents
- **.docx** - Microsoft Word (.docx format only)
- **.txt** - Plain text files

### File Size Limits
- Maximum file size: 100MB (configurable on backend)
- Recommended: < 50MB for better performance

### Upload Progress
- Real-time progress tracking via XMLHttpRequest
- Percentage display: 0-100%
- Status messages: "Uploading...", success/error

---

## Local Storage Schema

### Canary History Storage
**Key:** `canary_watermark_history`
**Type:** JSON array of entries

**Entry Schema:**
```javascript
{
  canaryId: "uuid-string",           // Unique identifier from X-Canary-ID header
  outputPath: "/path/to/file",       // Server path from X-Output-Path header
  filename: "document_name_canary",  // Output filename
  hash: "sha256-hash-string",        // SHA-256 from X-Canary-Hash header
  date: "2026-01-24T14:23:00Z",     // ISO 8601 timestamp
  original: "original-filename.pdf", // Original input filename
  size: 1024000,                     // File size in bytes
  type: "application/pdf"            // MIME type
}
```

**Storage Limit:** 10 entries (oldest deleted when limit reached)

---

## API Integration

### Endpoint 1: Watermark File
```
POST /canary/watermark
Content-Type: multipart/form-data

Request Body:
- file: File object (PDF, DOCX, or TXT)

Response Headers:
- X-Canary-ID: UUID of canary
- X-Output-Path: Server file path
- X-Canary-Hash: SHA-256 hash
- X-Canary-Meta: JSON metadata object

Response Body:
- Binary file blob (watermarked document)
```

### Endpoint 2: Upload to RAG
```
POST /documents/upload
Content-Type: multipart/form-data

Request Body:
- file: File object (watermarked file)
- sensitivity: "high" (for canary documents)

Response Body:
{
  "message": "File uploaded successfully",
  "document": {
    "name": "filename",
    "sensitivity": "high",
    "status": "Scanned",
    "issues": [],
    "acl_tags": ["restricted"]
  }
}
```

---

## State Management

### Component State
```javascript
// Canary History
const [history, setHistory] = useState([])

// Upload Status
const [uploading, setUploading] = useState(false)

// Progress
const [progress, setProgress] = useState(0)

// Messages
const [uploadSuccess, setUploadSuccess] = useState(null)
const [uploadError, setUploadError] = useState(null)

// Modals
const [deleteConfirm, setDeleteConfirm] = useState(null)
```

### Data Persistence
- History persisted to localStorage
- Survives page refresh
- Lost when localStorage is cleared

---

## User Workflows

### Basic Watermarking
1. User navigates to `/canary`
2. Clicks file input or "Choose File"
3. Selects PDF/DOCX/TXT file
4. Progress bar appears
5. File auto-downloads when complete
6. Entry added to history table

### Upload to RAG
1. User sees generated canary in history
2. Clicks "Upload" button
3. File is fetched from server
4. Uploaded to RAG with `sensitivity="high"`
5. Document appears in `/documents` page

### Delete Canary
1. User clicks "Delete" for history entry
2. Confirmation modal appears
3. On confirm, entry removed from history
4. localStorage updated

---

## Error Handling

### User-Facing Errors
- "No file provided" - File input was empty
- "Unsupported file type" - File extension not PDF/DOCX/TXT
- "Failed to watermark document" - Server processing error
- "Failed to fetch watermarked file" - Network error
- "Failed to upload to RAG" - Document upload error

### Silent Failures (Logged to Console)
- Failed to parse X-Canary-Meta header
- localStorage access errors
- File blob creation errors

---

## Performance Considerations

### Load Time
- Component renders instantly
- History loads from localStorage (< 10ms)
- Upload progress updates via XHR (real-time)

### Memory Usage
- History array limited to 10 entries
- File blob freed after download
- No large data structures in memory

### Network
- Multipart form upload with streaming
- Progress callbacks every 100-500ms
- Automatic cleanup of temp files on server

---

## Browser Compatibility

### Supported Browsers
- Chrome/Edge: 90+
- Firefox: 88+
- Safari: 14+
- Mobile Safari (iOS): 14+

### Required Browser APIs
- Fetch API (can fallback to XMLHttpRequest for progress)
- File API
- Blob API
- localStorage
- XMLHttpRequest

### NOT Supported
- Internet Explorer (any version)
- Opera Mini
- Ancient mobile browsers

---

## Testing Checklist

- [ ] Upload PDF file (small, medium, large)
- [ ] Upload DOCX file
- [ ] Upload TXT file
- [ ] Verify progress bar updates
- [ ] Verify auto-download works
- [ ] Verify history table shows entry
- [ ] Verify delete confirmation modal
- [ ] Verify "Upload to RAG" button
- [ ] Verify error messages display
- [ ] Verify localStorage persistence
- [ ] Test on mobile browser
- [ ] Test on slow network (DevTools throttling)

---

## Environment Variables

No frontend environment variables required for canary feature.

Backend URL comes from:
```javascript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5200"
```

---

## Future Enhancements

### Phase 2
- [ ] Drag-and-drop file upload
- [ ] Batch upload multiple files
- [ ] Preview watermarked files
- [ ] Canary template selection
- [ ] Custom watermark text

### Phase 3
- [ ] Canary scheduling (auto-generate weekly)
- [ ] Canary management dashboard
- [ ] Real-time retrieval alerts
- [ ] Export canary audit logs
- [ ] Advanced steganographic options

---

## Documentation References

- **Canary Service:** `/backend/services/canary_service.py`
- **API Endpoint:** `/backend/api/canary.py`
- **Backend Requirements:** `/backend/CANARY_REQUIREMENTS.txt`
- **Component Code:** `/frontend/src/components/CanaryWatermark.jsx`
- **Service Layer:** `/frontend/src/services/documentService.js`
