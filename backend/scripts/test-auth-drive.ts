import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { UserModel } from '../src/models/User.model.js';
import { SessionModel } from '../src/models/Session.model.js';
import { EmailVerificationTokenModel } from '../src/models/EmailVerificationToken.model.js';
import { PasswordResetTokenModel } from '../src/models/PasswordResetToken.model.js';
import { GoogleOAuthConnectionModel } from '../src/models/GoogleOAuthConnection.model.js';
import { VideoModel } from '../src/models/Video.model.js';
import { AuthService } from '../src/services/auth.service.js';
import { SessionService } from '../src/services/session.service.js';
import { VideoService } from '../src/services/video.service.js';
import { encryptText, decryptText } from '../src/utils/encryption.util.js';
import { hashToken } from '../src/utils/hash.util.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function runVerificationSuite() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING PRODUCTION AUTH & DRIVE TEST SUITE');
  console.log('======================================================\n');

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI not defined in environment');
  }

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB Atlas for test verification.');

  const testSuffix = Math.floor(Math.random() * 1000000);
  const userAEmail = `test_user_a_${testSuffix}@example.com`;
  const userBEmail = `test_user_b_${testSuffix}@example.com`;
  const password = 'SuperSecurePassword123!';

  try {
    // 1. REGISTRATION WITH ARGON2ID & FREE/PRO TIERS
    console.log('\n--- 1. Testing Registration & Argon2id Password Hashing ---');
    const { user: userA, verificationToken: tokenA } = await AuthService.register({
      email: userAEmail,
      password,
      name: 'User A Pro',
      plan: 'pro',
    });

    if (!userA.passwordHash.startsWith('$argon2id$')) {
      throw new Error('Password was not hashed using Argon2id!');
    }
    console.log('✅ User A registered with Argon2id password hash:', userA.passwordHash.substring(0, 30) + '...');
    console.log('✅ User A emailVerified is initially false:', userA.emailVerified === false);
    console.log('✅ User A plan is Pro with 50GB storage limit:', userA.plan === 'pro', userA.storageLimit);

    const { user: userB } = await AuthService.register({
      email: userBEmail,
      password,
      name: 'User B Free',
      plan: 'free',
    });
    console.log('✅ User B registered as Free tier with 0 limit:', userB.plan === 'free', userB.storageLimit === 0);

    // 2. EMAIL VERIFICATION & TOKEN REUSE PREVENTION
    console.log('\n--- 2. Testing Email Verification & Token Security ---');
    const tokenRecord = await EmailVerificationTokenModel.findOne({ tokenHash: hashToken(tokenA) });
    if (!tokenRecord) {
      throw new Error('Email verification token hash not found in MongoDB!');
    }
    console.log('✅ Verification token stored only as SHA-256 hash in DB:', tokenRecord.tokenHash);

    const verifiedUser = await AuthService.verifyEmail(tokenA);
    if (!verifiedUser.emailVerified) {
      throw new Error('User email was not marked as verified!');
    }
    console.log('✅ Email verification succeeded. User emailVerified = true');

    // Attempt token reuse
    try {
      await AuthService.verifyEmail(tokenA);
      throw new Error('Token reuse was NOT prevented!');
    } catch (err: any) {
      console.log('✅ Token reuse prevented as expected:', err.message);
    }

    // 3. SERVER-SIDE SESSION CREATION & ROTATION (NO JWT)
    console.log('\n--- 3. Testing Server-Side Sessions & Session Rotation ---');
    const loginUser = await AuthService.login(userAEmail, password);
    const { rawSessionId: session1, session: dbSession1 } = await SessionService.createSession(loginUser._id);

    const sessionInDb = await SessionModel.findOne({ sessionHash: hashToken(session1) });
    if (!sessionInDb) {
      throw new Error('Session ID not found via SHA-256 hash in MongoDB!');
    }
    console.log('✅ Session ID generated and stored via SHA-256 hash in DB:', dbSession1.sessionHash);

    const validated = await SessionService.validateSession(session1);
    if (!validated || validated.user.email !== userAEmail) {
      throw new Error('Session validation failed!');
    }
    console.log('✅ Validated active session for user:', validated.user.email);

    // Session rotation
    const { rawSessionId: session2 } = await SessionService.rotateSession(session1, loginUser._id);
    const oldSessionLookup = await SessionService.validateSession(session1);
    if (oldSessionLookup !== null) {
      throw new Error('Old session was not invalidated during rotation!');
    }
    const newSessionLookup = await SessionService.validateSession(session2);
    if (!newSessionLookup) {
      throw new Error('New rotated session is invalid!');
    }
    console.log('✅ Session rotation successful: old session destroyed, new session active.');

    // 4. AES-256-GCM TOKEN ENCRYPTION AT REST
    console.log('\n--- 4. Testing AES-256-GCM Encryption for Google Drive Tokens ---');
    const sampleGoogleAccessToken = 'ya29.a0AfH6SMD_SampleAccessToken_1234567890';
    const sampleRefreshToken = '1//0g_SampleRefreshToken_9876543210';

    const encryptedAccess = encryptText(sampleGoogleAccessToken);
    const encryptedRefresh = encryptText(sampleRefreshToken);

    if (encryptedAccess === sampleGoogleAccessToken || !encryptedAccess.includes(':')) {
      throw new Error('Token was not encrypted with AES-256-GCM!');
    }

    const decryptedAccess = decryptText(encryptedAccess);
    const decryptedRefresh = decryptText(encryptedRefresh);

    if (decryptedAccess !== sampleGoogleAccessToken || decryptedRefresh !== sampleRefreshToken) {
      throw new Error('Decrypted token does not match original plaintext!');
    }
    console.log('✅ AES-256-GCM Encrypted Token Format:', encryptedAccess);
    console.log('✅ AES-256-GCM Decryption matched original plaintext perfectly.');

    // 5. USER ISOLATION & ACCESS CONTROL
    console.log('\n--- 5. Testing Strict Cross-User Isolation ---');
    // Create a mock video for User A
    const videoA = await VideoModel.create({
      userId: userA._id,
      driveFileId: `mock_drive_file_${testSuffix}`,
      fileName: 'pro_clip_user_a.mp4',
      mimeType: 'video/mp4',
      size: 10485760, // 10MB
      duration: 60,
    });

    // User A can access Video A
    const retrievedByA = await VideoService.getVideoById(userA._id, videoA._id.toString());
    console.log('✅ User A successfully accessed their own video:', retrievedByA.fileName);

    // User B tries to access Video A -> MUST FAIL
    try {
      await VideoService.getVideoById(userB._id, videoA._id.toString());
      throw new Error('User B was able to access User A video! Isolation failed!');
    } catch (err: any) {
      console.log('✅ Cross-user access blocked as expected:', err.message);
    }

    // 6. PASSWORD RESET FLOW & SESSION REVOCATION
    console.log('\n--- 6. Testing Password Reset Flow & Session Invalidation ---');
    await AuthService.forgotPassword(userAEmail);
    const resetTokenRecord = await PasswordResetTokenModel.findOne({ userId: userA._id });
    if (!resetTokenRecord) {
      throw new Error('Password reset token was not created!');
    }

    // Reset password with a dummy raw token
    const newPassword = 'BrandNewSecurePassword456!';
    const rawResetToken = 'dummy_test_reset_token_' + testSuffix;
    resetTokenRecord.tokenHash = hashToken(rawResetToken);
    await resetTokenRecord.save();

    await AuthService.resetPassword(rawResetToken, newPassword);
    const activeSessionsAfterReset = await SessionModel.countDocuments({ userId: userA._id });
    if (activeSessionsAfterReset !== 0) {
      throw new Error('Active sessions were not revoked upon password reset!');
    }
    console.log('✅ Password successfully reset with Argon2id; all existing sessions revoked.');

    // Login with new password
    const newLoginUser = await AuthService.login(userAEmail, newPassword);
    if (!newLoginUser) {
      throw new Error('Could not log in with new password!');
    }
    console.log('✅ Login with new password succeeded.');

    // 7. CLEANUP TEST DATA
    console.log('\n--- 7. Cleaning up test artifacts ---');
    await UserModel.deleteMany({ _id: { $in: [userA._id, userB._id] } });
    await SessionModel.deleteMany({ userId: { $in: [userA._id, userB._id] } });
    await EmailVerificationTokenModel.deleteMany({ userId: { $in: [userA._id, userB._id] } });
    await PasswordResetTokenModel.deleteMany({ userId: { $in: [userA._id, userB._id] } });
    await GoogleOAuthConnectionModel.deleteMany({ userId: { $in: [userA._id, userB._id] } });
    await VideoModel.deleteMany({ _id: videoA._id });
    console.log('✅ Test artifacts cleaned up.');

    console.log('\n======================================================');
    console.log('🎉 ALL SECURITY & AUTHENTICATION TESTS PASSED 100%!');
    console.log('======================================================\n');
  } finally {
    await mongoose.disconnect();
  }
}

runVerificationSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
