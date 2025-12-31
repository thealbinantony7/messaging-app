# Walkthrough - Password Authentication & Centralized Config

## Overview
This update transitions authentication to a robust Email + Password flow (V1) and centralizes the application name to "LUCENT".

## ✅ Setup Complete
The database is initialized, and the environment is configured. 

### Instructions:
1.  **Open the App**: go to `http://localhost:5173`.
2.  **Toggle to Register**: Click "Sign up" at the bottom of the login card.
3.  **Create Account**: Enter your Email, a Password, and your Display Name.
4.  **Confirm**: You should be logged in immediately.

## 🛠️ Infrastructure (Already Running)
- **Postgres**: Storing users and messages.
- **Redis**: Handling real-time presence and pub/sub.
- **MinIO**: Handling file uploads (Avatars/Images).

Everything is ready!
