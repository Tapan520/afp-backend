# ?? Quick Start - File Upload Feature

## 5-Minute Setup

### Backend (Already Done ?)
The file upload feature is already implemented in the backend. Just deploy:

```bash
cd afp-backend
git add .
git commit -m "Add file upload feature"
git push origin main
```

### Frontend (Update Expo Snack)

1. **Open Expo Snack:** https://snack.expo.dev

2. **Add Dependencies:**
   Click "+" button ? Search and add:
   - `expo-image-picker`
   - `expo-document-picker`

3. **Replace Code:**
   - Copy `AllForPet_Connectes_AppV3.0.js`
   - Paste into Snack

4. **Update API URL (Line 11):**
   ```javascript
   const API_BASE = 'https://YOUR-APP.up.railway.app';
   ```

5. **Test on Phone:**
   - Install Expo Go app
   - Scan QR code
   - Done! ??

---

## Test Upload in 30 Seconds

1. **Login:** Use demo account
   - Mobile: `9876543210`
   - Password: `demo1234`

2. **Upload Photo:**
   - Tap on pet profile
   - Tap pet avatar (camera icon)
   - Select image
   - See green checkmark ?

3. **Upload Certificate:**
   - Go to Health tab
   - Tap "Upload certificate"
   - Select PDF/image
   - See success toast ?

---

## API Endpoints Cheat Sheet

### Upload Photo
```bash
POST /api/pets/{petId}/upload-photo
Headers: Authorization: Bearer {token}
Body: FormData with "photo" field
```

### Upload Certificate
```bash
POST /api/pets/{petId}/upload-certificate
Headers: Authorization: Bearer {token}
Body: FormData with "certificate" field
```

### Test with cURL
```bash
# Get token
curl -X POST https://YOUR-API.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"9876543210","password":"demo1234"}'

# Upload photo
curl -X POST https://YOUR-API.railway.app/api/pets/1/upload-photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@dog.jpg"
```

---

## File Storage

### Development (Railway)
```
uploads/
??? pets/           # Pet photos
??? certificates/   # Vaccination certs
??? doctors/        # Doctor photos
??? shops/          # Shop photos
```

?? **Warning:** Files deleted on Railway redeploy (ephemeral storage)

### Production (Recommended)
Use cloud storage:
- **Cloudinary** (easiest)
- **AWS S3** (scalable)
- **Google Cloud Storage**

---

## Troubleshooting Quick Fix

| Problem | Solution |
|---------|----------|
| Upload fails | Check file size < 10MB |
| Permission denied | Grant photo access in settings |
| Files disappear | Use cloud storage in production |
| Can't select files | Reinstall app, grant permissions |
| Upload timeout | Reduce image quality |

---

## File Validation

? **Allowed:**
- JPG, JPEG, PNG (images)
- PDF (documents)
- Max size: 10MB

? **Rejected:**
- Other file types
- Files > 10MB

---

## Security Checklist

- ? JWT authentication required
- ? Users can only upload to own pets
- ? File type validation
- ? Size limit enforced
- ? Unique filenames prevent overwrite

---

## Database Columns

Pet photos stored in `pets` table:
- `photo_url` - Path to pet photo
- `certificate_url` - Path to vaccination certificate

Example:
```sql
SELECT id, name, photo_url, certificate_url 
FROM pets 
WHERE photo_url IS NOT NULL;
```

---

## Success Indicators

When upload works correctly:
1. ? Green checkmark appears
2. ? Success toast shows
3. ? File visible in Documents tab
4. ? File accessible via URL
5. ? Database updated

---

## Next Steps

1. ? Deploy backend to Railway
2. ? Update Expo Snack with new code
3. ? Test on real device
4. ? Upload a pet photo
5. ? Upload a certificate
6. ? Verify in Documents tab

**For detailed docs, see:**
- `FILE_UPLOAD_GUIDE.md` - Full implementation guide
- `TESTING_GUIDE.md` - Testing scenarios
- `UPLOAD_FEATURE_SUMMARY.md` - Complete overview

---

**Ready to test? Let's go! ??**
