# Image Handling Guide (Debts)

This file documents all image-related work in the debts flow, including upload, storage, deletion, and troubleshooting.

## Overview

Images are used in the debts feature (`app/debts/page.jsx`) with this lifecycle:

1. User selects image in the debt form.
2. Image uploads to Cloudinary using unsigned upload.
3. Firestore debt document stores:
   - `imageUrl` (Cloudinary `secure_url`)
   - `imagePublicId` (Cloudinary `public_id`)
4. On debt deletion (or full settlement deletion), app attempts:
   - delete image from Cloudinary via server API route
   - delete debt doc from Firestore

## Files Involved

- `app/debts/page.jsx`
- `app/api/delete-image/route.js`
- `.env.local`

## Upload Flow

### Frontend upload function

In `app/debts/page.jsx`, `uploadImageToCloudinary(file)`:

- Sends `POST` to:
  - `https://api.cloudinary.com/v1_1/drtdv4iyr/image/upload`
- Uses:
  - `upload_preset = cashat_abod`
- Expects response fields:
  - `secure_url`
  - `public_id`
- Returns:
  - `imageUrl`
  - `imagePublicId`

### Firestore fields saved

Debt payload stores:

- `imageUrl`
- `imagePublicId`

Both are handled for:

- create
- edit (replace image)
- edit (remove image -> clears both fields)

## Deletion Flow

### Server API Route

`POST /api/delete-image` in `app/api/delete-image/route.js`

- Uses `cloudinary` npm package (v2).
- Reads server env vars:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
- Request body:
  - `{ publicId }`
- Action:
  - `cloudinary.uploader.destroy(publicId)`
- Returns JSON:
  - success response on `ok` or `not found`
  - error response with status and message when failing

### Frontend debt deletion helper

In `app/debts/page.jsx`, deletion goes through helper logic:

- If `imagePublicId` exists -> call `/api/delete-image`
- If missing -> skip image deletion
- Then delete Firestore debt doc

Current behavior includes fallback:

- If Cloudinary deletion fails, debt doc can still be deleted from Firestore (with warning log/toast), so settlement/deletion flow is not blocked.

## Required Environment Variables

In `.env.local`:

```env
CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_API_KEY
CLOUDINARY_API_SECRET=YOUR_API_SECRET
```

Important:

- These 3 values must come from the same Cloudinary product environment/account.
- Do not use `NEXT_PUBLIC_` for API secret values.

After any `.env.local` change:

1. Stop dev server.
2. Run `npm run dev` again.

## Common Problems and Causes

### 1) `Cloudinary server credentials are missing`

Cause:

- One or more env vars are missing, misspelled, or not loaded yet.

Fix:

- Check exact names in `.env.local`.
- Restart dev server.

### 2) `Invalid cloud_name ...`

Cause:

- `CLOUDINARY_CLOUD_NAME` is wrong, or does not match API key/secret account.

Fix:

- Copy cloud name from Cloudinary dashboard exactly.
- Ensure key/secret belong to same environment.

### 3) API fails with `{}` in frontend logs

Cause:

- Non-JSON or unexpected response from server.

Fix:

- Frontend was updated to parse both JSON and text responses and log status details.

## Quick Verification Checklist

1. Create debt with image:
   - Debt appears with image in table.
   - Firestore has `imageUrl` + `imagePublicId`.
2. Full settlement delete:
   - Debt is removed from Firestore.
   - Cloudinary asset is removed (when server env is correct).
3. Debt with missing `imagePublicId`:
   - Firestore delete still works.
4. Check terminal logs:
   - no `Missing Cloudinary env vars`
   - no `Invalid cloud_name`

## Security Notes

- API secrets are server-side only in route handler.
- Do not expose `CLOUDINARY_API_SECRET` to frontend.
- Unsigned upload preset is only for upload and does not replace secure server-side deletion.
