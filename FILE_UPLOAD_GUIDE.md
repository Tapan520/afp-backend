# ?? File Upload Feature - Implementation Guide

## Overview
The All For Pets application now supports file uploads for:
- ?? **Pet Photos** (JPG, PNG)
- ?? **Vaccination Certificates** (PDF, JPG, PNG)

## Backend Implementation

### 1. Multer Configuration
Location: `src/middleware/upload.js`

**Features:**
- Automatic directory creation for organized storage
- File type validation (images and PDFs only)
- Size limit: 10MB (configurable via `MAX_FILE_SIZE_MB` env var)
- Unique filename generation with timestamps

**Directory Structure:**
```
uploads/
??? pets/           # Pet photos
??? certificates/   # Vaccination certificates
??? doctors/        # Doctor photos (future)
??? shops/          # Shop photos (future)
```

### 2. API Endpoints

#### Upload Pet Photo
```http
POST /api/pets/:id/upload-photo
Authorization: Bearer <token>
Content-Type: multipart/form-data

Body: FormData with field "photo"
```

**Response:**
```json
{
  "message": "Photo uploaded successfully",
  "pet": { ...updated pet object }
}
```

#### Upload Vaccination Certificate
```http
POST /api/pets/:id/upload-certificate
Authorization: Bearer <token>
Content-Type: multipart/form-data

Body: FormData with field "certificate"
```

**Response:**
```json
{
  "message": "Certificate uploaded successfully",
  "pet": { ...updated pet object }
}
```

#### Upload Files During Registration (Optional)
```http
POST /api/pets/upload-files
Authorization: Bearer <token>
Content-Type: multipart/form-data

Body: FormData with fields "photo" and/or "certificate"
```

**Response:**
```json
{
  "message": "Files uploaded successfully",
  "files": {
    "photoUrl": "/uploads/pets/photo-1234567890.jpg",
    "certificateUrl": "/uploads/certificates/certificate-1234567890.pdf"
  }
}
```

### 3. Database Schema
The `pets` table includes:
- `photo_url` TEXT - Stores the path to pet photo
- `certificate_url` TEXT - Stores the path to vaccination certificate

## Frontend Implementation (Expo React Native)

### 1. Required Expo Packages
Add to your Expo project:
```bash
expo install expo-image-picker expo-document-picker
```

### 2. Permissions
The app automatically requests permissions when users try to upload:
- **iOS**: Camera Roll access
- **Android**: Storage access

### 3. Upload Functions

#### Pick & Upload Photo
```javascript
async function pickImage() {
  // Request permissions
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return;

  // Launch image picker
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (!result.canceled) {
    const file = result.assets[0];
    await uploadFile(`/api/pets/${petId}/upload-photo`, file, 'photo');
  }
}
```

#### Pick & Upload Certificate
```javascript
async function pickDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    copyToCacheDirectory: true,
  });

  if (result.type === 'success') {
    await uploadFile(`/api/pets/${petId}/upload-certificate`, result, 'certificate');
  }
}
```

#### Upload Helper Function
```javascript
async function uploadFile(path, file, fieldName = 'photo') {
  const formData = new FormData();
  formData.append(fieldName, {
    uri: file.uri,
    type: file.mimeType || 'image/jpeg',
    name: file.name || `${fieldName}.jpg`,
  });
  
  const headers = {};
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });
  
  return await res.json();
}
```

## Usage Flows

### 1. Upload Photo on Pet Profile
1. User navigates to Pet Profile ? Details tab
2. Taps on the pet avatar (with camera icon)
3. Selects image from gallery
4. Image automatically uploads to server
5. Photo URL stored in database
6. Green checkmark shows upload success

### 2. Upload Certificate on Pet Profile
1. User navigates to Pet Profile ? Health tab
2. Taps "Upload vaccination certificate" box
3. Selects PDF or image from device
4. File automatically uploads to server
5. Certificate URL stored in database
6. Document status updated to "Uploaded"

### 3. Upload During Pet Registration
1. User fills pet registration form
2. Taps upload boxes for photo and/or certificate
3. Selects files from device
4. Files show as "selected" with green checkmark
5. On form submission, pet record is created first
6. Then files are uploaded asynchronously
7. Even if uploads fail, pet registration succeeds

## File Access

### Viewing Uploaded Files
Files are served as static assets via Express:
```javascript
app.use('/uploads', express.static(uploadDir));
```

**Access URLs:**
- Photos: `https://your-domain.railway.app/uploads/pets/photo-123456.jpg`
- Certificates: `https://your-domain.railway.app/uploads/certificates/cert-123456.pdf`

## Security Considerations

### 1. File Type Validation
- Backend validates file extensions and MIME types
- Only allows: `.jpg`, `.jpeg`, `.png`, `.pdf`

### 2. Size Limits
- Default: 10MB per file
- Configure via `MAX_FILE_SIZE_MB` environment variable

### 3. Authentication
- All upload endpoints require valid JWT token
- Users can only upload files for their own pets
- Admins have broader access

### 4. Unique Filenames
- Prevents overwriting with timestamp + random number
- Format: `photo-1234567890-987654321.jpg`

## Deployment Notes

### Railway.app
1. **Uploads Directory**: Railway has ephemeral filesystem
   - Files uploaded will be lost on redeploy
   - **Solution**: Use cloud storage (AWS S3, Cloudinary) for production

2. **Environment Variables**:
   ```
   MAX_FILE_SIZE_MB=10
   ```

### Production Recommendations
For production deployment, integrate cloud storage:

#### Option 1: Cloudinary
```bash
npm install cloudinary multer-storage-cloudinary
```

#### Option 2: AWS S3
```bash
npm install @aws-sdk/client-s3 multer-s3
```

#### Option 3: Google Cloud Storage
```bash
npm install @google-cloud/storage multer-storage-google-cloud
```

## Testing

### Test Photo Upload (Postman/cURL)
```bash
curl -X POST https://your-api.railway.app/api/pets/1/upload-photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@/path/to/dog.jpg"
```

### Test Certificate Upload
```bash
curl -X POST https://your-api.railway.app/api/pets/1/upload-certificate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "certificate=@/path/to/vaccine.pdf"
```

## Troubleshooting

### Issue: "No file uploaded"
- **Cause**: FormData field name mismatch
- **Solution**: Ensure field name is `photo` or `certificate`

### Issue: "Only .jpg, .jpeg, .png and .pdf files are allowed"
- **Cause**: Invalid file type
- **Solution**: Check file extension and MIME type

### Issue: Files not persisting after deploy
- **Cause**: Railway's ephemeral filesystem
- **Solution**: Migrate to cloud storage (S3, Cloudinary)

### Issue: Upload timeout
- **Cause**: Large file size or slow network
- **Solution**: Reduce image quality or increase timeout

## Future Enhancements

1. **Image Optimization**
   - Compress images on upload
   - Generate thumbnails
   - Convert to WebP format

2. **Cloud Storage Integration**
   - AWS S3 for scalability
   - CDN for faster delivery

3. **Multiple Photos**
   - Allow uploading multiple pet photos
   - Create photo gallery

4. **File Management**
   - Delete/replace files
   - Version control

5. **Preview Before Upload**
   - Show selected file preview
   - Crop/rotate images

## Support
For issues or questions about file uploads:
- Check the logs in Railway dashboard
- Verify file permissions on server
- Test with smaller files first
- Ensure correct Content-Type headers

---

**Last Updated**: 2024
**Version**: 1.0
