# ?? File Upload Feature - Testing Guide

## Quick Start Testing

### Step 1: Deploy Backend
1. Push code to GitHub:
   ```bash
   git add .
   git commit -m "Add file upload feature"
   git push origin main
   ```

2. Railway will auto-deploy
3. Wait for deployment to complete (~2-3 minutes)

### Step 2: Setup Expo App
1. Go to https://snack.expo.dev
2. Create a new Snack
3. Copy contents of `AllForPet_Connectes_AppV3.0.js`
4. Paste into the main file
5. Add dependencies:
   - Click "+" in the left panel
   - Search and add: `expo-image-picker`
   - Search and add: `expo-document-picker`

### Step 3: Update API URL
In the app code, update line 11:
```javascript
const API_BASE = 'https://YOUR-APP-NAME.up.railway.app';
```
Replace with your actual Railway URL.

### Step 4: Test on Device
1. Install Expo Go app on your phone:
   - iOS: App Store
   - Android: Google Play Store
2. Scan QR code from Expo Snack
3. App will load on your device

## Test Scenarios

### ? Test 1: Upload Photo During Pet Registration

**Steps:**
1. Login with demo account: `9876543210` / `demo1234`
2. Tap "Register new pet"
3. Fill in pet details:
   - Name: Test Dog
   - Species: Dog
   - Breed: Golden Retriever
   - Colour: Golden
   - Gender: Male
   - DOB: 2022-01-15
4. Tap "Upload pet photo" box
5. Select an image from gallery
6. Verify green checkmark appears
7. Submit registration

**Expected Result:**
- ? Pet registered successfully
- ? Photo uploaded (even if registration succeeds without photo)
- ? Toast shows "? Test Dog registered!"
- ? Redirected to dashboard

**Verify in Database:**
```sql
SELECT id, name, photo_url FROM pets ORDER BY id DESC LIMIT 1;
```

---

### ? Test 2: Upload Certificate on Existing Pet

**Steps:**
1. Login as citizen
2. Go to Dashboard
3. Tap on any approved pet
4. Go to "Health" tab
5. Tap "Upload vaccination certificate"
6. Select a PDF or image
7. Wait for upload to complete

**Expected Result:**
- ? "Uploading certificate..." indicator shows
- ? Toast shows "? Certificate uploaded successfully!"
- ? Upload box changes to green with checkmark
- ? Go to "Documents" tab - certificate shows as "Uploaded"

---

### ? Test 3: Update Pet Photo

**Steps:**
1. Login as citizen
2. Tap on a pet with photo
3. Tap on the pet avatar (camera icon)
4. Select new image
5. Wait for upload

**Expected Result:**
- ? Loading indicator on avatar
- ? Toast shows "? Photo uploaded successfully!"
- ? Avatar border turns green
- ? Checkmark appears on camera icon

---

### ? Test 4: View Uploaded Files in Documents

**Steps:**
1. Upload photo and certificate for a pet
2. Wait for admin approval
3. Go to Pet Profile ? Documents tab

**Expected Result:**
- ? Shows "Vaccination Certificate" with "Uploaded" status
- ? Shows "Pet Photo" with "Uploaded" status
- ? Both have green "PDF/JPG" badges
- ? Download buttons are visible

---

### ? Test 5: File Validation (Backend)

**Test Invalid File Type:**
```bash
# Try uploading a .txt file
curl -X POST https://your-api.railway.app/api/pets/1/upload-photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@test.txt"
```

**Expected Result:**
```json
{
  "error": "Only .jpg, .jpeg, .png and .pdf files are allowed"
}
```

**Test Oversized File:**
Upload a file larger than 10MB

**Expected Result:**
```json
{
  "error": "File too large"
}
```

---

### ? Test 6: Permission Checks

**Test Uploading to Another User's Pet:**
1. Login as User A
2. Get pet ID from User B
3. Try to upload photo to User B's pet

**Expected Result:**
```json
{
  "error": "Pet not found or not authorized"
}
```

---

### ? Test 7: No File Selected

**Steps:**
1. Go to pet registration
2. Fill all fields EXCEPT photo/certificate
3. Submit

**Expected Result:**
- ? Pet registered successfully
- ? photo_url and certificate_url are NULL in database
- ? No errors

---

## Manual API Testing (Postman/cURL)

### 1. Login to Get Token
```bash
curl -X POST https://your-api.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "9876543210",
    "password": "demo1234"
  }'
```

Save the `token` from response.

### 2. Upload Pet Photo
```bash
curl -X POST https://your-api.railway.app/api/pets/1/upload-photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@/path/to/dog.jpg"
```

### 3. Upload Certificate
```bash
curl -X POST https://your-api.railway.app/api/pets/1/upload-certificate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "certificate=@/path/to/vaccine.pdf"
```

### 4. Check Pet Data
```bash
curl -X GET https://your-api.railway.app/api/pets/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Look for:**
```json
{
  "id": 1,
  "name": "Bruno",
  "photo_url": "/uploads/pets/photo-1234567890.jpg",
  "certificate_url": "/uploads/certificates/certificate-1234567890.pdf"
}
```

### 5. View Uploaded File
Open in browser:
```
https://your-api.railway.app/uploads/pets/photo-1234567890.jpg
```

---

## Database Verification

### Check Uploads in PostgreSQL
```sql
-- See all pets with uploaded files
SELECT 
  id, 
  name, 
  photo_url, 
  certificate_url,
  created_at
FROM pets
WHERE photo_url IS NOT NULL 
   OR certificate_url IS NOT NULL;

-- Count uploads
SELECT 
  COUNT(CASE WHEN photo_url IS NOT NULL THEN 1 END) as photos_uploaded,
  COUNT(CASE WHEN certificate_url IS NOT NULL THEN 1 END) as certs_uploaded,
  COUNT(*) as total_pets
FROM pets;
```

---

## Error Scenarios to Test

### ? Error 1: No Authentication
```bash
curl -X POST https://your-api.railway.app/api/pets/1/upload-photo \
  -F "photo=@dog.jpg"
```
**Expected:** `401 Unauthorized`

### ? Error 2: Invalid Token
```bash
curl -X POST https://your-api.railway.app/api/pets/1/upload-photo \
  -H "Authorization: Bearer invalid_token" \
  -F "photo=@dog.jpg"
```
**Expected:** `401 Invalid or expired token`

### ? Error 3: Pet Not Found
```bash
curl -X POST https://your-api.railway.app/api/pets/99999/upload-photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@dog.jpg"
```
**Expected:** `404 Pet not found or not authorized`

### ? Error 4: Missing File
```bash
curl -X POST https://your-api.railway.app/api/pets/1/upload-photo \
  -H "Authorization: Bearer YOUR_TOKEN"
```
**Expected:** `400 No file uploaded`

### ? Error 5: Wrong Field Name
```bash
curl -X POST https://your-api.railway.app/api/pets/1/upload-photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@dog.jpg"  # Should be "photo"
```
**Expected:** `400 No file uploaded`

---

## Performance Testing

### File Upload Speed
Test with different file sizes:
- Small: 100KB
- Medium: 1MB
- Large: 5MB
- Max: 10MB

**Measure:**
- Upload time
- Server response time
- Network usage

### Concurrent Uploads
Simulate multiple users uploading simultaneously:
```bash
# Run 5 uploads in parallel
for i in {1..5}; do
  curl -X POST https://your-api.railway.app/api/pets/$i/upload-photo \
    -H "Authorization: Bearer TOKEN_$i" \
    -F "photo=@dog$i.jpg" &
done
wait
```

---

## Mobile App Testing Checklist

### iOS Testing
- [ ] Image picker opens correctly
- [ ] Document picker opens correctly
- [ ] Upload progress shows
- [ ] Success toast appears
- [ ] Files persist after app restart
- [ ] Works on different iOS versions (13+)

### Android Testing
- [ ] Image picker opens correctly
- [ ] Document picker opens correctly
- [ ] Permissions requested properly
- [ ] Upload progress shows
- [ ] Success toast appears
- [ ] Works on different Android versions (8+)

### Network Conditions
- [ ] Upload works on WiFi
- [ ] Upload works on 4G
- [ ] Handles slow network gracefully
- [ ] Shows error on network failure
- [ ] Retries on failure

---

## Troubleshooting

### Problem: Upload fails silently
**Solution:**
1. Check Railway logs: `railway logs`
2. Verify file size < 10MB
3. Check file type is allowed
4. Verify API URL is correct

### Problem: "Permission denied" on app
**Solution:**
1. Uninstall and reinstall app
2. Grant photo library permission
3. Check device settings

### Problem: Files disappear after deployment
**Solution:**
Railway has ephemeral storage. For production:
1. Migrate to S3/Cloudinary
2. Or use Railway volumes (paid plan)

### Problem: Slow uploads
**Solution:**
1. Reduce image quality in ImagePicker config
2. Compress images before upload
3. Use smaller file sizes

---

## Success Criteria

? **All tests pass when:**
1. Photos upload successfully from app
2. Certificates upload successfully from app
3. Files are accessible via URL
4. Database stores correct file paths
5. Users can only upload to their own pets
6. Invalid file types are rejected
7. Oversized files are rejected
8. App handles errors gracefully
9. Upload progress is visible
10. Success/error messages appear

---

## Next Steps After Testing

1. **If all tests pass:**
   - Deploy to production
   - Monitor logs for errors
   - Gather user feedback

2. **If tests fail:**
   - Check Railway logs
   - Verify environment variables
   - Test API endpoints with Postman
   - Check network connectivity
   - Review error messages

3. **Production considerations:**
   - Set up cloud storage (AWS S3 or Cloudinary)
   - Add image optimization
   - Implement upload retry logic
   - Add file deletion feature
   - Monitor storage usage

---

**Happy Testing! ??**
