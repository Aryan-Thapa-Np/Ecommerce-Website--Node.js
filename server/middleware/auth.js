/**
 * Authentication Middleware
 * Handles JWT verification, role-based access control, and account status checks
 */

import jwt from "jsonwebtoken";
import { query } from "../database/db.js";

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const accessToken = req.cookies?.accessToken;
    const refreshToken = req.cookies?.refreshToken;
   


    if (!accessToken && !refreshToken) {
   

      return res.redirect("/login");
    }

    let userId;
    let userRole;
    let sessionId;
    let userdata;


    if (accessToken) {
      // Try access token first
      try {
        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (error) {

        if (error.name !== "TokenExpiredError" || !refreshToken) {
          res.clearCookie('accessToken');
        
          return res.redirect("/login");
        }
      }
    }

    if (!userId && refreshToken) {
      // Verify refresh token and check session
      

      const verifyRefreshToken = jwt.verify(refreshToken, process.env.JWT_SECRET);
      userId = verifyRefreshToken.id;

      const [user] = await query(`select refresh_token,id as session_id from user_sessions where user_id = ? and refresh_token = ? and is_active = true and expires_at > NOW()`, [userId, refreshToken]);
      if (!user) {
      
        return res.redirect("/login");
      }
      sessionId = user.id;
      //end----
    }
    //end----


    const [userData] = await query(
      `SELECT * from users where id = ?`,
      [userId]
    );

   



    if (!userData) {
    
      return res.redirect("/login");
    }


    userId = userData.id;
    userdata = userData;
    userRole = userData.role_id;


    // Log session activity
    if (sessionId) {
      await query(
        'INSERT INTO session_activities (session_id, activity_type, ip_address) VALUES (?, ?, ?)',
        [sessionId, 'auth_check', req.ip]
      );
    }



    // Check account status
    if (userData.account_status !== 'active') {
      if (userData.account_status_expiry && new Date(userData.account_status_expiry) < new Date()) {
        // Reactivate account if lock/suspension period has expired
        await query(
          'UPDATE users SET account_status = "active", account_status_reason = NULL, account_status_expiry = NULL WHERE id = ?',
          [userId]
        );


      } else {
        return res.render("accountinfo", {
          supportEmail: 'cartify@gmail.com',
          accountStatus: userData.account_status,
          reason: userData.account_status_reason,
          message: `Your account is ${userData.account_status}.`,
          expire: userData.account_status_expiry,
        });
      }

    }


    req.user = userId;
    req.role = userRole;
    req.userInfo = userdata;


    next();
  } catch (error) {

    return res.redirect("/login");
  }
};









// Check if user account is active
const checkAccountStatus = async (req, res, next) => {

  // Get token from Authorization header

  const token = req.cookies?.accessToken;
  const refresh_token = req.cookies?.refreshToken;



  try {
    // Verify the token


    if (refresh_token) {
      const decoded = jwt.verify(refresh_token, process.env.JWT_SECRET);
      req.user = decoded.id;
      const [rows] = await query(`select account_status,account_status_reason,account_status_expiry  from users where id = ?`, [req.user]);
      const status = rows.account_status;
      const reason = rows.account_status_reason;
      const expire = rows.account_status_expiry;
      if (expire) {
        if (expire < new Date()) {
          await query(`update users set account_status = ?, account_status_reason = ?, account_status_expiry = ? where id = ?`, ["active", null, null, req.user]);
        }
      }
      if (status !== 'active') {
        return res.status(200).render('accountinfo', {
          supportEmail: 'cartify@gmail.com',
          accountStatus: status,
          reason: reason,
          message: `Your account is ${status}.`,
          expire: expire,
        });
      }
      next();
    } else {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded.id;
      const [rows] = await query(`select account_status,account_status_reason,account_status_expiry  from users where id = ?`, [req.user]);
      const status = rows.account_status;
      const reason = rows.account_status_reason;
      const expire = rows.account_status_expiry;
      if (expire) {
        if (expire < new Date()) {
          await query(`update users set account_status = ?, account_status_reason = ?, account_status_expiry = ? where id = ?`, ["active", null, null, req.user]);
        }
      }
      if (status !== 'active') {
        return res.status(200).render('accountinfo', {
          supportEmail: 'cartify@gmail.com',
          accountStatus: status,
          reason: reason,
          message: `Your account is ${status}.`,
          expire: expire,
        });
      }

      next();
    }
  } catch (error) {
    next();
  }


};




// Check user role
const checkRole = (roles) => {
  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    try {
      const userRoles = await query(
        `SELECT r.name 
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.id = ?`,
        [req.user.id]
      );

      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({
          success: false,
          message: "User has no assigned role",
        });
      }

      const userRole = userRoles[0].name;

      if (roles.includes(userRole)) {
        return next();
      } else {
        return res.status(403).json({
          success: false,
          message: "Access denied. Insufficient permissions.",
        });
      }
    } catch (error) {

      res.render('500');
    }
  };
};

// Check if user is the owner of the resource or an admin
const checkOwnershipOrAdmin = (paramIdField) => {
  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    try {
      // Get the target user ID from request parameters
      const targetUserId = parseInt(req.params[paramIdField]);

      if (isNaN(targetUserId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      // Check if the authenticated user is the owner
      if (req.user.id === targetUserId) {
        return next();
      }

      // Check if the authenticated user is an admin
      const userRole = await query(
        `SELECT r.name 
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.id = ?`,
        [req.user.id]
      );

      if (userRole && userRole.length > 0 && userRole[0].name === "admin") {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: "Access denied. You can only access your own resources.",
      });
    } catch (error) {

      res.render('500');
    }
  };
};


const checkAdminOrStaff = (req, res, next) => {

  if (req.role === 1 || req.role === 2) {

    return next();
  }


  return res.render("404", {
    title: "404 - Page Not Found",
    user: req.user || null,
  });
}





const checkCustomer = (req, res, next) => {
  if (req.role === 3) {
    return next();
  }
  return res.render("404", {
    title: "404 - Page Not Found",
    user: req.user || null,
  });
}



const requireAdmin = (req, res, next) => {
  if (req.role === 1) {
    return next();
  }
  return res.render("404", {
    title: "404 - Page Not Found",
    user: req.user || null,
  });
}
const permission = (req, res, next) => {
  if (req.role === 1) {
    return next();
  }
  return res.json({
    status: 403,
    success: false,
    message: "insufficient permissions",
  });
}



const checkAuth = async (req, res, next) => {
  try {
    const accessToken = req.cookies?.accessToken;
    const refreshToken = req.cookies?.refreshToken;





    let userId;
    let userRole;
    let sessionId;


    if (accessToken) {
      // Try access token first
      try {
        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (error) {

        if (error.name !== "TokenExpiredError" || !refreshToken) {
          res.clearCookie('accessToken');

        }
      }
    }

    if (!userId && refreshToken) {
      // Verify refresh token and check session

      const verifyRefreshToken = jwt.verify(refreshToken, process.env.JWT_SECRET);
      userId = verifyRefreshToken.id;

      const [user] = await query(`select refresh_token,id as session_id from user_sessions where user_id = ? and refresh_token = ? and is_active = true and expires_at > NOW()`, [userId, refreshToken]);
      if (user) {
        sessionId = user.id;
      }

      //end----
    }
    //end----
    if (userId) {


      const [userData] = await query(
        `SELECT u.*, p.*
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE u.id = ?`,
        [userId]
      );

      if (userData) {
        userId = userData.id;
        userRole = userData.role_id;



        // Check account status
        if (userData.account_status !== 'active') {
          if (userData.account_status_expiry && new Date(userData.account_status_expiry) < new Date()) {
            // Reactivate account if lock/suspension period has expired
            await query(
              'UPDATE users SET account_status = "active", account_status_reason = NULL, account_status_expiry = NULL WHERE id = ?',
              [userId]
            );


          } else {
            return res.render("accountinfo", {
              supportEmail: 'cartify@gmail.com',
              accountStatus: userData.account_status,
              reason: userData.account_status_reason,
              message: `Your account is ${userData.account_status}.`,
              expire: userData.account_status_expiry,
            });
          }

        }


        req.user = userId;
        req.role = userRole;
        req.userData = userData;

      }
    }



    next();
  } catch (error) {

    res.render('500');
  }

}




export { verifyToken, checkAccountStatus, checkRole, checkOwnershipOrAdmin, checkAdminOrStaff, checkCustomer, requireAdmin, checkAuth, permission };