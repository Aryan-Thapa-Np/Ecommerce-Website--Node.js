/**
 * Authentication Controller - Register Function
 */

import { query } from "../database/db.js";
import { hashPassword, generateOTP } from "../utils/auth.js";
import { sendVerificationEmail } from "../utils/email.js";
import { logAuthEvent } from "../utils/logger.js";

// Register a new user
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Hash password
    const hashedPassword = await hashPassword(password);

    //check if the user already exists
    const user = await query("SELECT * FROM users WHERE email = ?", [email]);

    if (user.length > 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        msg: "User already exists",
      });
    }


    // Insert user into database with customer role (role_id = 3)
    const result = await query(
      "INSERT INTO users (username, email, password, role_id) VALUES (?, ?, ?, ?)",
      [username, email, hashedPassword, 3]
    );

    const userId = result.insertId;
    
   

    // Generate OTP for email verification
    const otp = generateOTP();
    const expiryTime = new Date(
      Date.now() + parseInt(process.env.OTP_EXPIRY || 600000)
    ); // 10 minutes

    // Store OTP in database
    await query(
      "INSERT INTO otps (user_id, email, otp, type, expires_at) VALUES (?, ?, ?, ?, ?)",
      [userId, email, otp, "email_verification", expiryTime]
    );

    // Send verification email
    await sendVerificationEmail(email, otp);

    // Log registration event
    await logAuthEvent(
      userId,
      "registration",
      "User registered successfully",
      req
    );

    return res.status(201).json({
      success: true,
      message:
        "User registered successfully. Please check your email for verification code.",
      userId,
    });
  } catch (error) {
   
    return res.status(200).json({
      status:"error",
      success: false,
      message: "Error registering user",
    });
  }
};

export { register };
